!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Enum=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function (global){
"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var os = _interopRequire(_dereq_("os"));

var EnumItem = _interopRequire(_dereq_("./enumItem"));

var _isType = _dereq_("./isType");

var isString = _isType.isString;
var isNumber = _isType.isNumber;

var indexOf = _dereq_("./indexOf").indexOf;

var isBuffer = _interopRequire(_dereq_("is-buffer"));

var endianness = os.endianness();

/**
 * Represents an Enum with enum items.
 * @param {Array || Object}  map     This are the enum items.
 * @param {String || Object} options This are options. [optional]
 */

var Enum = (function () {
  function Enum(map, options) {
    var _this = this;

    _classCallCheck(this, Enum);

    /* implement the "ref type interface", so that Enum types can
     * be used in `node-ffi` function declarations and invokations.
     * In C, these Enums act as `uint32_t` types.
     *
     * https://github.com/TooTallNate/ref#the-type-interface
     */
    this.size = 4;
    this.indirection = 1;

    if (options && isString(options)) {
      options = { name: options };
    }

    this._options = options || {};
    this._options.separator = this._options.separator || " | ";
    this._options.endianness = this._options.endianness || endianness;
    this._options.ignoreCase = this._options.ignoreCase || false;
    this._options.freez = this._options.freez || false;

    this.enums = [];

    if (map.length) {
      this._enumLastIndex = map.length;
      var array = map;
      map = {};

      for (var i = 0; i < array.length; i++) {
        map[array[i]] = Math.pow(2, i);
      }
    }

    for (var member in map) {
      guardReservedKeys(this._options.name, member);
      this[member] = new EnumItem(member, map[member], { ignoreCase: this._options.ignoreCase });
      this.enums.push(this[member]);
    }
    this._enumMap = map;

    if (this._options.ignoreCase) {
      this.getLowerCaseEnums = function () {
        var res = {};
        for (var i = 0, len = this.enums.length; i < len; i++) {
          res[this.enums[i].key.toLowerCase()] = this.enums[i];
        }
        return res;
      };
    }

    if (this._options.name) {
      this.name = this._options.name;
    }

    var isFlaggable = function () {
      for (var i = 0, len = _this.enums.length; i < len; i++) {
        var e = _this.enums[i];

        if (!(e.value !== 0 && !(e.value & e.value - 1))) {
          return false;
        }
      }
      return true;
    };

    this.isFlaggable = isFlaggable();
    if (this._options.freez) {
      this.freezeEnums(); //this will make instances of Enum non-extensible
    }
  }

  /**
   * Returns the appropriate EnumItem key.
   * @param  {EnumItem || String || Number} key The object to get with.
   * @return {String}                           The get result.
   */

  Enum.prototype.getKey = function getKey(value) {
    var item = this.get(value);
    if (item) {
      return item.key;
    }
  };

  /**
   * Returns the appropriate EnumItem value.
   * @param  {EnumItem || String || Number} key The object to get with.
   * @return {Number}                           The get result.
   */

  Enum.prototype.getValue = function getValue(key) {
    var item = this.get(key);
    if (item) {
      return item.value;
    }
  };

  /**
   * Returns the appropriate EnumItem.
   * @param  {EnumItem || String || Number} key The object to get with.
   * @return {EnumItem}                         The get result.
   */

  Enum.prototype.get = function get(key, offset) {
    if (key === null || key === undefined) {
      return;
    } // Buffer instance support, part of the ref Type interface
    if (isBuffer(key)) {
      key = key["readUInt32" + this._options.endianness](offset || 0);
    }

    if (EnumItem.isEnumItem(key)) {
      var foundIndex = indexOf.call(this.enums, key);
      if (foundIndex >= 0) {
        return key;
      }
      if (!this.isFlaggable || this.isFlaggable && key.key.indexOf(this._options.separator) < 0) {
        return;
      }
      return this.get(key.key);
    } else if (isString(key)) {

      var enums = this;
      if (this._options.ignoreCase) {
        enums = this.getLowerCaseEnums();
        key = key.toLowerCase();
      }

      if (key.indexOf(this._options.separator) > 0) {
        var parts = key.split(this._options.separator);

        var value = 0;
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];

          value |= enums[part].value;
        }

        return new EnumItem(key, value);
      } else {
        return enums[key];
      }
    } else {
      for (var m in this) {
        if (this.hasOwnProperty(m)) {
          if (this[m].value === key) {
            return this[m];
          }
        }
      }

      var result = null;

      if (this.isFlaggable) {
        for (var n in this) {
          if (this.hasOwnProperty(n)) {
            if ((key & this[n].value) !== 0) {
              if (result) {
                result += this._options.separator;
              } else {
                result = "";
              }
              result += n;
            }
          }
        }
      }

      return this.get(result || null);
    }
  };

  /**
   * Sets the Enum "value" onto the give `buffer` at the specified `offset`.
   * Part of the ref "Type interface".
   *
   * @param  {Buffer} buffer The Buffer instance to write to.
   * @param  {Number} offset The offset in the buffer to write to. Default 0.
   * @param  {EnumItem || String || Number} value The EnumItem to write.
   */

  Enum.prototype.set = function set(buffer, offset, value) {
    var item = this.get(value);
    if (item) {
      return buffer["writeUInt32" + this._options.endianness](item.value, offset || 0);
    }
  };

  /**
   * Define freezeEnums() as a property of the prototype.
   * make enumerable items nonconfigurable and deep freeze the properties. Throw Error on property setter.
   */

  Enum.prototype.freezeEnums = function freezeEnums() {
    function envSupportsFreezing() {
      return Object.isFrozen && Object.isSealed && Object.getOwnPropertyNames && Object.getOwnPropertyDescriptor && Object.defineProperties && Object.__defineGetter__ && Object.__defineSetter__;
    }

    function freezer(o) {
      var props = Object.getOwnPropertyNames(o);
      props.forEach(function (p) {
        if (!Object.getOwnPropertyDescriptor(o, p).configurable) {
          return;
        }

        Object.defineProperties(o, p, { writable: false, configurable: false });
      });
      return o;
    }

    function getPropertyValue(value) {
      return value;
    }

    function deepFreezeEnums(o) {
      if (typeof o !== "object" || o === null || Object.isFrozen(o) || Object.isSealed(o)) {
        return;
      }
      for (var key in o) {
        if (o.hasOwnProperty(key)) {
          o.__defineGetter__(key, getPropertyValue.bind(null, o[key]));
          o.__defineSetter__(key, function throwPropertySetError(value) {
            throw TypeError("Cannot redefine property; Enum Type is not extensible.");
          });
          deepFreezeEnums(o[key]);
        }
      }
      if (Object.freeze) {
        Object.freeze(o);
      } else {
        freezer(o);
      }
    }

    if (envSupportsFreezing()) {
      deepFreezeEnums(this);
    }

    return this;
  };

  /**
   * Return true whether the enumItem parameter passed in is an EnumItem object and 
   * has been included as constant of this Enum   
   * @param  {EnumItem} enumItem
   */

  Enum.prototype.isDefined = function isDefined(enumItem) {
    var condition = function (e) {
      return e === enumItem;
    };
    if (isString(enumItem) || isNumber(enumItem)) {
      condition = function (e) {
        return e.is(enumItem);
      };
    }
    return this.enums.some(condition);
  };

  /**
   * Returns JSON object representation of this Enum.
   * @return {String} JSON object representation of this Enum.
   */

  Enum.prototype.toJSON = function toJSON() {
    return this._enumMap;
  };

  /**
   * Extends the existing Enum with a New Map.
   * @param  {Array}  map  Map to extend from
   */

  Enum.prototype.extend = function extend(map) {
    if (map.length) {
      var array = map;
      map = {};

      for (var i = 0; i < array.length; i++) {
        var exponent = this._enumLastIndex + i;
        map[array[i]] = Math.pow(2, exponent);
      }

      for (var member in map) {
        guardReservedKeys(this._options.name, member);
        this[member] = new EnumItem(member, map[member], { ignoreCase: this._options.ignoreCase });
        this.enums.push(this[member]);
      }

      for (var key in this._enumMap) {
        map[key] = this._enumMap[key];
      }

      this._enumLastIndex += map.length;
      this._enumMap = map;

      if (this._options.freez) {
        this.freezeEnums(); //this will make instances of new Enum non-extensible
      }
    }
  };

  /**
   * Registers the Enum Type globally in node.js.
   * @param  {String} key Global variable. [optional]
   */

  Enum.register = function register() {
    var key = arguments[0] === undefined ? "Enum" : arguments[0];

    if (!global[key]) {
      global[key] = Enum;
    }
  };

  Enum.prototype[Symbol.iterator] = function () {
    var _this = this;

    var index = 0;
    return {
      next: function () {
        return index < _this.enums.length ? { done: false, value: _this.enums[index++] } : { done: true };
      }
    };
  };

  return Enum;
})();

module.exports = Enum;

// private

var reservedKeys = ["_options", "get", "getKey", "getValue", "enums", "isFlaggable", "_enumMap", "toJSON", "_enumLastIndex"];

function guardReservedKeys(customName, key) {
  if (customName && key === "name" || indexOf.call(reservedKeys, key) >= 0) {
    throw new Error("Enum key " + key + " is a reserved word!");
  }
}
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./enumItem":2,"./indexOf":3,"./isType":4,"is-buffer":6,"os":7}],2:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _isType = _dereq_("./isType");

var isObject = _isType.isObject;
var isString = _isType.isString;

/**
 * Represents an Item of an Enum.
 * @param {String} key   The Enum key.
 * @param {Number} value The Enum value.
 */

var EnumItem = (function () {

  /*constructor reference so that, this.constructor===EnumItem//=>true */

  function EnumItem(key, value) {
    var options = arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, EnumItem);

    this.key = key;
    this.value = value;

    this._options = options;
    this._options.ignoreCase = this._options.ignoreCase || false;
  }

  /**
   * Checks if the flagged EnumItem has the passing object.
   * @param  {EnumItem || String || Number} value The object to check with.
   * @return {Boolean}                            The check result.
   */

  EnumItem.prototype.has = function has(value) {
    if (EnumItem.isEnumItem(value)) {
      return (this.value & value.value) !== 0;
    } else if (isString(value)) {
      if (this._options.ignoreCase) {
        return this.key.toLowerCase().indexOf(value.toLowerCase()) >= 0;
      }
      return this.key.indexOf(value) >= 0;
    } else {
      return (this.value & value) !== 0;
    }
  };

  /**
   * Checks if the EnumItem is the same as the passing object.
   * @param  {EnumItem || String || Number} key The object to check with.
   * @return {Boolean}                          The check result.
   */

  EnumItem.prototype.is = function is(key) {
    if (EnumItem.isEnumItem(key)) {
      return this.key === key.key;
    } else if (isString(key)) {
      if (this._options.ignoreCase) {
        return this.key.toLowerCase() === key.toLowerCase();
      }
      return this.key === key;
    } else {
      return this.value === key;
    }
  };

  /**
   * Returns String representation of this EnumItem.
   * @return {String} String representation of this EnumItem.
   */

  EnumItem.prototype.toString = function toString() {
    return this.key;
  };

  /**
   * Returns JSON object representation of this EnumItem.
   * @return {String} JSON object representation of this EnumItem.
   */

  EnumItem.prototype.toJSON = function toJSON() {
    return this.key;
  };

  /**
   * Returns the value to compare with.
   * @return {String} The value to compare with.
   */

  EnumItem.prototype.valueOf = function valueOf() {
    return this.value;
  };

  EnumItem.isEnumItem = function isEnumItem(value) {
    return value instanceof EnumItem || isObject(value) && value.key !== undefined && value.value !== undefined;
  };

  return EnumItem;
})();

module.exports = EnumItem;
},{"./isType":4}],3:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
var indexOf = Array.prototype.indexOf || function (find, i /*opt*/) {
  if (i === undefined) i = 0;
  if (i < 0) i += this.length;
  if (i < 0) i = 0;
  for (var n = this.length; i < n; i++) if (i in this && this[i] === find) return i;
  return -1;
};
exports.indexOf = indexOf;
},{}],4:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
var isType = function (type, value) {
  return typeof value === type;
};
exports.isType = isType;
var isObject = function (value) {
  return isType("object", value);
};
exports.isObject = isObject;
var isString = function (value) {
  return isType("string", value);
};
exports.isString = isString;
var isNumber = function (value) {
  return isType("number", value);
};
exports.isNumber = isNumber;
},{}],5:[function(_dereq_,module,exports){
module.exports = _dereq_('./dist/enum');

},{"./dist/enum":1}],6:[function(_dereq_,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],7:[function(_dereq_,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

},{}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9hZHJhaS9Qcm9qZWN0cy9lbnVtL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvYWRyYWkvUHJvamVjdHMvZW51bS9kaXN0L2VudW0uanMiLCIvVXNlcnMvYWRyYWkvUHJvamVjdHMvZW51bS9kaXN0L2VudW1JdGVtLmpzIiwiL1VzZXJzL2FkcmFpL1Byb2plY3RzL2VudW0vZGlzdC9pbmRleE9mLmpzIiwiL1VzZXJzL2FkcmFpL1Byb2plY3RzL2VudW0vZGlzdC9pc1R5cGUuanMiLCIvVXNlcnMvYWRyYWkvUHJvamVjdHMvZW51bS9mYWtlXzlkZjBmMDgxLmpzIiwiL1VzZXJzL2FkcmFpL1Byb2plY3RzL2VudW0vbm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIi9Vc2Vycy9hZHJhaS9Qcm9qZWN0cy9lbnVtL25vZGVfbW9kdWxlcy9vcy1icm93c2VyaWZ5L2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBfaW50ZXJvcFJlcXVpcmUgPSBmdW5jdGlvbiAob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmpbXCJkZWZhdWx0XCJdIDogb2JqOyB9O1xuXG52YXIgX2NsYXNzQ2FsbENoZWNrID0gZnVuY3Rpb24gKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH07XG5cbnZhciBvcyA9IF9pbnRlcm9wUmVxdWlyZShyZXF1aXJlKFwib3NcIikpO1xuXG52YXIgRW51bUl0ZW0gPSBfaW50ZXJvcFJlcXVpcmUocmVxdWlyZShcIi4vZW51bUl0ZW1cIikpO1xuXG52YXIgX2lzVHlwZSA9IHJlcXVpcmUoXCIuL2lzVHlwZVwiKTtcblxudmFyIGlzU3RyaW5nID0gX2lzVHlwZS5pc1N0cmluZztcbnZhciBpc051bWJlciA9IF9pc1R5cGUuaXNOdW1iZXI7XG5cbnZhciBpbmRleE9mID0gcmVxdWlyZShcIi4vaW5kZXhPZlwiKS5pbmRleE9mO1xuXG52YXIgaXNCdWZmZXIgPSBfaW50ZXJvcFJlcXVpcmUocmVxdWlyZShcImlzLWJ1ZmZlclwiKSk7XG5cbnZhciBlbmRpYW5uZXNzID0gb3MuZW5kaWFubmVzcygpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gRW51bSB3aXRoIGVudW0gaXRlbXMuXG4gKiBAcGFyYW0ge0FycmF5IHx8IE9iamVjdH0gIG1hcCAgICAgVGhpcyBhcmUgdGhlIGVudW0gaXRlbXMuXG4gKiBAcGFyYW0ge1N0cmluZyB8fCBPYmplY3R9IG9wdGlvbnMgVGhpcyBhcmUgb3B0aW9ucy4gW29wdGlvbmFsXVxuICovXG5cbnZhciBFbnVtID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRW51bShtYXAsIG9wdGlvbnMpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEVudW0pO1xuXG4gICAgLyogaW1wbGVtZW50IHRoZSBcInJlZiB0eXBlIGludGVyZmFjZVwiLCBzbyB0aGF0IEVudW0gdHlwZXMgY2FuXG4gICAgICogYmUgdXNlZCBpbiBgbm9kZS1mZmlgIGZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBhbmQgaW52b2thdGlvbnMuXG4gICAgICogSW4gQywgdGhlc2UgRW51bXMgYWN0IGFzIGB1aW50MzJfdGAgdHlwZXMuXG4gICAgICpcbiAgICAgKiBodHRwczovL2dpdGh1Yi5jb20vVG9vVGFsbE5hdGUvcmVmI3RoZS10eXBlLWludGVyZmFjZVxuICAgICAqL1xuICAgIHRoaXMuc2l6ZSA9IDQ7XG4gICAgdGhpcy5pbmRpcmVjdGlvbiA9IDE7XG5cbiAgICBpZiAob3B0aW9ucyAmJiBpc1N0cmluZyhvcHRpb25zKSkge1xuICAgICAgb3B0aW9ucyA9IHsgbmFtZTogb3B0aW9ucyB9O1xuICAgIH1cblxuICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMuX29wdGlvbnMuc2VwYXJhdG9yID0gdGhpcy5fb3B0aW9ucy5zZXBhcmF0b3IgfHwgXCIgfCBcIjtcbiAgICB0aGlzLl9vcHRpb25zLmVuZGlhbm5lc3MgPSB0aGlzLl9vcHRpb25zLmVuZGlhbm5lc3MgfHwgZW5kaWFubmVzcztcbiAgICB0aGlzLl9vcHRpb25zLmlnbm9yZUNhc2UgPSB0aGlzLl9vcHRpb25zLmlnbm9yZUNhc2UgfHwgZmFsc2U7XG4gICAgdGhpcy5fb3B0aW9ucy5mcmVleiA9IHRoaXMuX29wdGlvbnMuZnJlZXogfHwgZmFsc2U7XG5cbiAgICB0aGlzLmVudW1zID0gW107XG5cbiAgICBpZiAobWFwLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZW51bUxhc3RJbmRleCA9IG1hcC5sZW5ndGg7XG4gICAgICB2YXIgYXJyYXkgPSBtYXA7XG4gICAgICBtYXAgPSB7fTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBtYXBbYXJyYXlbaV1dID0gTWF0aC5wb3coMiwgaSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgbWVtYmVyIGluIG1hcCkge1xuICAgICAgZ3VhcmRSZXNlcnZlZEtleXModGhpcy5fb3B0aW9ucy5uYW1lLCBtZW1iZXIpO1xuICAgICAgdGhpc1ttZW1iZXJdID0gbmV3IEVudW1JdGVtKG1lbWJlciwgbWFwW21lbWJlcl0sIHsgaWdub3JlQ2FzZTogdGhpcy5fb3B0aW9ucy5pZ25vcmVDYXNlIH0pO1xuICAgICAgdGhpcy5lbnVtcy5wdXNoKHRoaXNbbWVtYmVyXSk7XG4gICAgfVxuICAgIHRoaXMuX2VudW1NYXAgPSBtYXA7XG5cbiAgICBpZiAodGhpcy5fb3B0aW9ucy5pZ25vcmVDYXNlKSB7XG4gICAgICB0aGlzLmdldExvd2VyQ2FzZUVudW1zID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmVudW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgcmVzW3RoaXMuZW51bXNbaV0ua2V5LnRvTG93ZXJDYXNlKCldID0gdGhpcy5lbnVtc1tpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fb3B0aW9ucy5uYW1lKSB7XG4gICAgICB0aGlzLm5hbWUgPSB0aGlzLl9vcHRpb25zLm5hbWU7XG4gICAgfVxuXG4gICAgdmFyIGlzRmxhZ2dhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IF90aGlzLmVudW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBlID0gX3RoaXMuZW51bXNbaV07XG5cbiAgICAgICAgaWYgKCEoZS52YWx1ZSAhPT0gMCAmJiAhKGUudmFsdWUgJiBlLnZhbHVlIC0gMSkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgdGhpcy5pc0ZsYWdnYWJsZSA9IGlzRmxhZ2dhYmxlKCk7XG4gICAgaWYgKHRoaXMuX29wdGlvbnMuZnJlZXopIHtcbiAgICAgIHRoaXMuZnJlZXplRW51bXMoKTsgLy90aGlzIHdpbGwgbWFrZSBpbnN0YW5jZXMgb2YgRW51bSBub24tZXh0ZW5zaWJsZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhcHByb3ByaWF0ZSBFbnVtSXRlbSBrZXkuXG4gICAqIEBwYXJhbSAge0VudW1JdGVtIHx8IFN0cmluZyB8fCBOdW1iZXJ9IGtleSBUaGUgb2JqZWN0IHRvIGdldCB3aXRoLlxuICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGdldCByZXN1bHQuXG4gICAqL1xuXG4gIEVudW0ucHJvdG90eXBlLmdldEtleSA9IGZ1bmN0aW9uIGdldEtleSh2YWx1ZSkge1xuICAgIHZhciBpdGVtID0gdGhpcy5nZXQodmFsdWUpO1xuICAgIGlmIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5rZXk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhcHByb3ByaWF0ZSBFbnVtSXRlbSB2YWx1ZS5cbiAgICogQHBhcmFtICB7RW51bUl0ZW0gfHwgU3RyaW5nIHx8IE51bWJlcn0ga2V5IFRoZSBvYmplY3QgdG8gZ2V0IHdpdGguXG4gICAqIEByZXR1cm4ge051bWJlcn0gICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgZ2V0IHJlc3VsdC5cbiAgICovXG5cbiAgRW51bS5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbiBnZXRWYWx1ZShrZXkpIHtcbiAgICB2YXIgaXRlbSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYXBwcm9wcmlhdGUgRW51bUl0ZW0uXG4gICAqIEBwYXJhbSAge0VudW1JdGVtIHx8IFN0cmluZyB8fCBOdW1iZXJ9IGtleSBUaGUgb2JqZWN0IHRvIGdldCB3aXRoLlxuICAgKiBAcmV0dXJuIHtFbnVtSXRlbX0gICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGdldCByZXN1bHQuXG4gICAqL1xuXG4gIEVudW0ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldChrZXksIG9mZnNldCkge1xuICAgIGlmIChrZXkgPT09IG51bGwgfHwga2V5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9IC8vIEJ1ZmZlciBpbnN0YW5jZSBzdXBwb3J0LCBwYXJ0IG9mIHRoZSByZWYgVHlwZSBpbnRlcmZhY2VcbiAgICBpZiAoaXNCdWZmZXIoa2V5KSkge1xuICAgICAga2V5ID0ga2V5W1wicmVhZFVJbnQzMlwiICsgdGhpcy5fb3B0aW9ucy5lbmRpYW5uZXNzXShvZmZzZXQgfHwgMCk7XG4gICAgfVxuXG4gICAgaWYgKEVudW1JdGVtLmlzRW51bUl0ZW0oa2V5KSkge1xuICAgICAgdmFyIGZvdW5kSW5kZXggPSBpbmRleE9mLmNhbGwodGhpcy5lbnVtcywga2V5KTtcbiAgICAgIGlmIChmb3VuZEluZGV4ID49IDApIHtcbiAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5pc0ZsYWdnYWJsZSB8fCB0aGlzLmlzRmxhZ2dhYmxlICYmIGtleS5rZXkuaW5kZXhPZih0aGlzLl9vcHRpb25zLnNlcGFyYXRvcikgPCAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmdldChrZXkua2V5KTtcbiAgICB9IGVsc2UgaWYgKGlzU3RyaW5nKGtleSkpIHtcblxuICAgICAgdmFyIGVudW1zID0gdGhpcztcbiAgICAgIGlmICh0aGlzLl9vcHRpb25zLmlnbm9yZUNhc2UpIHtcbiAgICAgICAgZW51bXMgPSB0aGlzLmdldExvd2VyQ2FzZUVudW1zKCk7XG4gICAgICAgIGtleSA9IGtleS50b0xvd2VyQ2FzZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoa2V5LmluZGV4T2YodGhpcy5fb3B0aW9ucy5zZXBhcmF0b3IpID4gMCkge1xuICAgICAgICB2YXIgcGFydHMgPSBrZXkuc3BsaXQodGhpcy5fb3B0aW9ucy5zZXBhcmF0b3IpO1xuXG4gICAgICAgIHZhciB2YWx1ZSA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuXG4gICAgICAgICAgdmFsdWUgfD0gZW51bXNbcGFydF0udmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEVudW1JdGVtKGtleSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGVudW1zW2tleV07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIG0gaW4gdGhpcykge1xuICAgICAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShtKSkge1xuICAgICAgICAgIGlmICh0aGlzW21dLnZhbHVlID09PSBrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW21dO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgaWYgKHRoaXMuaXNGbGFnZ2FibGUpIHtcbiAgICAgICAgZm9yICh2YXIgbiBpbiB0aGlzKSB7XG4gICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkobikpIHtcbiAgICAgICAgICAgIGlmICgoa2V5ICYgdGhpc1tuXS52YWx1ZSkgIT09IDApIHtcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSB0aGlzLl9vcHRpb25zLnNlcGFyYXRvcjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBcIlwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc3VsdCArPSBuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5nZXQocmVzdWx0IHx8IG51bGwpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogU2V0cyB0aGUgRW51bSBcInZhbHVlXCIgb250byB0aGUgZ2l2ZSBgYnVmZmVyYCBhdCB0aGUgc3BlY2lmaWVkIGBvZmZzZXRgLlxuICAgKiBQYXJ0IG9mIHRoZSByZWYgXCJUeXBlIGludGVyZmFjZVwiLlxuICAgKlxuICAgKiBAcGFyYW0gIHtCdWZmZXJ9IGJ1ZmZlciBUaGUgQnVmZmVyIGluc3RhbmNlIHRvIHdyaXRlIHRvLlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IG9mZnNldCBUaGUgb2Zmc2V0IGluIHRoZSBidWZmZXIgdG8gd3JpdGUgdG8uIERlZmF1bHQgMC5cbiAgICogQHBhcmFtICB7RW51bUl0ZW0gfHwgU3RyaW5nIHx8IE51bWJlcn0gdmFsdWUgVGhlIEVudW1JdGVtIHRvIHdyaXRlLlxuICAgKi9cblxuICBFbnVtLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBzZXQoYnVmZmVyLCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgdmFyIGl0ZW0gPSB0aGlzLmdldCh2YWx1ZSk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIHJldHVybiBidWZmZXJbXCJ3cml0ZVVJbnQzMlwiICsgdGhpcy5fb3B0aW9ucy5lbmRpYW5uZXNzXShpdGVtLnZhbHVlLCBvZmZzZXQgfHwgMCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBEZWZpbmUgZnJlZXplRW51bXMoKSBhcyBhIHByb3BlcnR5IG9mIHRoZSBwcm90b3R5cGUuXG4gICAqIG1ha2UgZW51bWVyYWJsZSBpdGVtcyBub25jb25maWd1cmFibGUgYW5kIGRlZXAgZnJlZXplIHRoZSBwcm9wZXJ0aWVzLiBUaHJvdyBFcnJvciBvbiBwcm9wZXJ0eSBzZXR0ZXIuXG4gICAqL1xuXG4gIEVudW0ucHJvdG90eXBlLmZyZWV6ZUVudW1zID0gZnVuY3Rpb24gZnJlZXplRW51bXMoKSB7XG4gICAgZnVuY3Rpb24gZW52U3VwcG9ydHNGcmVlemluZygpIHtcbiAgICAgIHJldHVybiBPYmplY3QuaXNGcm96ZW4gJiYgT2JqZWN0LmlzU2VhbGVkICYmIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzICYmIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgJiYgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgJiYgT2JqZWN0Ll9fZGVmaW5lR2V0dGVyX18gJiYgT2JqZWN0Ll9fZGVmaW5lU2V0dGVyX187XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZnJlZXplcihvKSB7XG4gICAgICB2YXIgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvKTtcbiAgICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24gKHApIHtcbiAgICAgICAgaWYgKCFPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG8sIHApLmNvbmZpZ3VyYWJsZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKG8sIHAsIHsgd3JpdGFibGU6IGZhbHNlLCBjb25maWd1cmFibGU6IGZhbHNlIH0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQcm9wZXJ0eVZhbHVlKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVlcEZyZWV6ZUVudW1zKG8pIHtcbiAgICAgIGlmICh0eXBlb2YgbyAhPT0gXCJvYmplY3RcIiB8fCBvID09PSBudWxsIHx8IE9iamVjdC5pc0Zyb3plbihvKSB8fCBPYmplY3QuaXNTZWFsZWQobykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIG8pIHtcbiAgICAgICAgaWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIG8uX19kZWZpbmVHZXR0ZXJfXyhrZXksIGdldFByb3BlcnR5VmFsdWUuYmluZChudWxsLCBvW2tleV0pKTtcbiAgICAgICAgICBvLl9fZGVmaW5lU2V0dGVyX18oa2V5LCBmdW5jdGlvbiB0aHJvd1Byb3BlcnR5U2V0RXJyb3IodmFsdWUpIHtcbiAgICAgICAgICAgIHRocm93IFR5cGVFcnJvcihcIkNhbm5vdCByZWRlZmluZSBwcm9wZXJ0eTsgRW51bSBUeXBlIGlzIG5vdCBleHRlbnNpYmxlLlwiKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBkZWVwRnJlZXplRW51bXMob1trZXldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKE9iamVjdC5mcmVlemUpIHtcbiAgICAgICAgT2JqZWN0LmZyZWV6ZShvKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyZWV6ZXIobyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVudlN1cHBvcnRzRnJlZXppbmcoKSkge1xuICAgICAgZGVlcEZyZWV6ZUVudW1zKHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdHJ1ZSB3aGV0aGVyIHRoZSBlbnVtSXRlbSBwYXJhbWV0ZXIgcGFzc2VkIGluIGlzIGFuIEVudW1JdGVtIG9iamVjdCBhbmQgXG4gICAqIGhhcyBiZWVuIGluY2x1ZGVkIGFzIGNvbnN0YW50IG9mIHRoaXMgRW51bSAgIFxuICAgKiBAcGFyYW0gIHtFbnVtSXRlbX0gZW51bUl0ZW1cbiAgICovXG5cbiAgRW51bS5wcm90b3R5cGUuaXNEZWZpbmVkID0gZnVuY3Rpb24gaXNEZWZpbmVkKGVudW1JdGVtKSB7XG4gICAgdmFyIGNvbmRpdGlvbiA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICByZXR1cm4gZSA9PT0gZW51bUl0ZW07XG4gICAgfTtcbiAgICBpZiAoaXNTdHJpbmcoZW51bUl0ZW0pIHx8IGlzTnVtYmVyKGVudW1JdGVtKSkge1xuICAgICAgY29uZGl0aW9uID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgcmV0dXJuIGUuaXMoZW51bUl0ZW0pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZW51bXMuc29tZShjb25kaXRpb24pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIEpTT04gb2JqZWN0IHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgRW51bS5cbiAgICogQHJldHVybiB7U3RyaW5nfSBKU09OIG9iamVjdCByZXByZXNlbnRhdGlvbiBvZiB0aGlzIEVudW0uXG4gICAqL1xuXG4gIEVudW0ucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTigpIHtcbiAgICByZXR1cm4gdGhpcy5fZW51bU1hcDtcbiAgfTtcblxuICAvKipcbiAgICogRXh0ZW5kcyB0aGUgZXhpc3RpbmcgRW51bSB3aXRoIGEgTmV3IE1hcC5cbiAgICogQHBhcmFtICB7QXJyYXl9ICBtYXAgIE1hcCB0byBleHRlbmQgZnJvbVxuICAgKi9cblxuICBFbnVtLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbiBleHRlbmQobWFwKSB7XG4gICAgaWYgKG1hcC5sZW5ndGgpIHtcbiAgICAgIHZhciBhcnJheSA9IG1hcDtcbiAgICAgIG1hcCA9IHt9O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBleHBvbmVudCA9IHRoaXMuX2VudW1MYXN0SW5kZXggKyBpO1xuICAgICAgICBtYXBbYXJyYXlbaV1dID0gTWF0aC5wb3coMiwgZXhwb25lbnQpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBtZW1iZXIgaW4gbWFwKSB7XG4gICAgICAgIGd1YXJkUmVzZXJ2ZWRLZXlzKHRoaXMuX29wdGlvbnMubmFtZSwgbWVtYmVyKTtcbiAgICAgICAgdGhpc1ttZW1iZXJdID0gbmV3IEVudW1JdGVtKG1lbWJlciwgbWFwW21lbWJlcl0sIHsgaWdub3JlQ2FzZTogdGhpcy5fb3B0aW9ucy5pZ25vcmVDYXNlIH0pO1xuICAgICAgICB0aGlzLmVudW1zLnB1c2godGhpc1ttZW1iZXJdKTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuX2VudW1NYXApIHtcbiAgICAgICAgbWFwW2tleV0gPSB0aGlzLl9lbnVtTWFwW2tleV07XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2VudW1MYXN0SW5kZXggKz0gbWFwLmxlbmd0aDtcbiAgICAgIHRoaXMuX2VudW1NYXAgPSBtYXA7XG5cbiAgICAgIGlmICh0aGlzLl9vcHRpb25zLmZyZWV6KSB7XG4gICAgICAgIHRoaXMuZnJlZXplRW51bXMoKTsgLy90aGlzIHdpbGwgbWFrZSBpbnN0YW5jZXMgb2YgbmV3IEVudW0gbm9uLWV4dGVuc2libGVcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyB0aGUgRW51bSBUeXBlIGdsb2JhbGx5IGluIG5vZGUuanMuXG4gICAqIEBwYXJhbSAge1N0cmluZ30ga2V5IEdsb2JhbCB2YXJpYWJsZS4gW29wdGlvbmFsXVxuICAgKi9cblxuICBFbnVtLnJlZ2lzdGVyID0gZnVuY3Rpb24gcmVnaXN0ZXIoKSB7XG4gICAgdmFyIGtleSA9IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gXCJFbnVtXCIgOiBhcmd1bWVudHNbMF07XG5cbiAgICBpZiAoIWdsb2JhbFtrZXldKSB7XG4gICAgICBnbG9iYWxba2V5XSA9IEVudW07XG4gICAgfVxuICB9O1xuXG4gIEVudW0ucHJvdG90eXBlW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4IDwgX3RoaXMuZW51bXMubGVuZ3RoID8geyBkb25lOiBmYWxzZSwgdmFsdWU6IF90aGlzLmVudW1zW2luZGV4KytdIH0gOiB7IGRvbmU6IHRydWUgfTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIHJldHVybiBFbnVtO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbnVtO1xuXG4vLyBwcml2YXRlXG5cbnZhciByZXNlcnZlZEtleXMgPSBbXCJfb3B0aW9uc1wiLCBcImdldFwiLCBcImdldEtleVwiLCBcImdldFZhbHVlXCIsIFwiZW51bXNcIiwgXCJpc0ZsYWdnYWJsZVwiLCBcIl9lbnVtTWFwXCIsIFwidG9KU09OXCIsIFwiX2VudW1MYXN0SW5kZXhcIl07XG5cbmZ1bmN0aW9uIGd1YXJkUmVzZXJ2ZWRLZXlzKGN1c3RvbU5hbWUsIGtleSkge1xuICBpZiAoY3VzdG9tTmFtZSAmJiBrZXkgPT09IFwibmFtZVwiIHx8IGluZGV4T2YuY2FsbChyZXNlcnZlZEtleXMsIGtleSkgPj0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVudW0ga2V5IFwiICsga2V5ICsgXCIgaXMgYSByZXNlcnZlZCB3b3JkIVwiKTtcbiAgfVxufVxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIF9jbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9O1xuXG52YXIgX2lzVHlwZSA9IHJlcXVpcmUoXCIuL2lzVHlwZVwiKTtcblxudmFyIGlzT2JqZWN0ID0gX2lzVHlwZS5pc09iamVjdDtcbnZhciBpc1N0cmluZyA9IF9pc1R5cGUuaXNTdHJpbmc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBJdGVtIG9mIGFuIEVudW0uXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5ICAgVGhlIEVudW0ga2V5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIFRoZSBFbnVtIHZhbHVlLlxuICovXG5cbnZhciBFbnVtSXRlbSA9IChmdW5jdGlvbiAoKSB7XG5cbiAgLypjb25zdHJ1Y3RvciByZWZlcmVuY2Ugc28gdGhhdCwgdGhpcy5jb25zdHJ1Y3Rvcj09PUVudW1JdGVtLy89PnRydWUgKi9cblxuICBmdW5jdGlvbiBFbnVtSXRlbShrZXksIHZhbHVlKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzJdO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEVudW1JdGVtKTtcblxuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcblxuICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuX29wdGlvbnMuaWdub3JlQ2FzZSA9IHRoaXMuX29wdGlvbnMuaWdub3JlQ2FzZSB8fCBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIGZsYWdnZWQgRW51bUl0ZW0gaGFzIHRoZSBwYXNzaW5nIG9iamVjdC5cbiAgICogQHBhcmFtICB7RW51bUl0ZW0gfHwgU3RyaW5nIHx8IE51bWJlcn0gdmFsdWUgVGhlIG9iamVjdCB0byBjaGVjayB3aXRoLlxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgY2hlY2sgcmVzdWx0LlxuICAgKi9cblxuICBFbnVtSXRlbS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24gaGFzKHZhbHVlKSB7XG4gICAgaWYgKEVudW1JdGVtLmlzRW51bUl0ZW0odmFsdWUpKSB7XG4gICAgICByZXR1cm4gKHRoaXMudmFsdWUgJiB2YWx1ZS52YWx1ZSkgIT09IDA7XG4gICAgfSBlbHNlIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICAgIGlmICh0aGlzLl9vcHRpb25zLmlnbm9yZUNhc2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMua2V5LnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZS50b0xvd2VyQ2FzZSgpKSA+PSAwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMua2V5LmluZGV4T2YodmFsdWUpID49IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAodGhpcy52YWx1ZSAmIHZhbHVlKSAhPT0gMDtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgRW51bUl0ZW0gaXMgdGhlIHNhbWUgYXMgdGhlIHBhc3Npbmcgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtFbnVtSXRlbSB8fCBTdHJpbmcgfHwgTnVtYmVyfSBrZXkgVGhlIG9iamVjdCB0byBjaGVjayB3aXRoLlxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGNoZWNrIHJlc3VsdC5cbiAgICovXG5cbiAgRW51bUl0ZW0ucHJvdG90eXBlLmlzID0gZnVuY3Rpb24gaXMoa2V5KSB7XG4gICAgaWYgKEVudW1JdGVtLmlzRW51bUl0ZW0oa2V5KSkge1xuICAgICAgcmV0dXJuIHRoaXMua2V5ID09PSBrZXkua2V5O1xuICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoa2V5KSkge1xuICAgICAgaWYgKHRoaXMuX29wdGlvbnMuaWdub3JlQ2FzZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5rZXkudG9Mb3dlckNhc2UoKSA9PT0ga2V5LnRvTG93ZXJDYXNlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5rZXkgPT09IGtleTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWUgPT09IGtleTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgRW51bUl0ZW0uXG4gICAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgRW51bUl0ZW0uXG4gICAqL1xuXG4gIEVudW1JdGVtLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmtleTtcbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyBKU09OIG9iamVjdCByZXByZXNlbnRhdGlvbiBvZiB0aGlzIEVudW1JdGVtLlxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IEpTT04gb2JqZWN0IHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgRW51bUl0ZW0uXG4gICAqL1xuXG4gIEVudW1JdGVtLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgcmV0dXJuIHRoaXMua2V5O1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSB0byBjb21wYXJlIHdpdGguXG4gICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIHZhbHVlIHRvIGNvbXBhcmUgd2l0aC5cbiAgICovXG5cbiAgRW51bUl0ZW0ucHJvdG90eXBlLnZhbHVlT2YgPSBmdW5jdGlvbiB2YWx1ZU9mKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICB9O1xuXG4gIEVudW1JdGVtLmlzRW51bUl0ZW0gPSBmdW5jdGlvbiBpc0VudW1JdGVtKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRW51bUl0ZW0gfHwgaXNPYmplY3QodmFsdWUpICYmIHZhbHVlLmtleSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlLnZhbHVlICE9PSB1bmRlZmluZWQ7XG4gIH07XG5cbiAgcmV0dXJuIEVudW1JdGVtO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbnVtSXRlbTsiLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbnZhciBpbmRleE9mID0gQXJyYXkucHJvdG90eXBlLmluZGV4T2YgfHwgZnVuY3Rpb24gKGZpbmQsIGkgLypvcHQqLykge1xuICBpZiAoaSA9PT0gdW5kZWZpbmVkKSBpID0gMDtcbiAgaWYgKGkgPCAwKSBpICs9IHRoaXMubGVuZ3RoO1xuICBpZiAoaSA8IDApIGkgPSAwO1xuICBmb3IgKHZhciBuID0gdGhpcy5sZW5ndGg7IGkgPCBuOyBpKyspIGlmIChpIGluIHRoaXMgJiYgdGhpc1tpXSA9PT0gZmluZCkgcmV0dXJuIGk7XG4gIHJldHVybiAtMTtcbn07XG5leHBvcnRzLmluZGV4T2YgPSBpbmRleE9mOyIsIlwidXNlIHN0cmljdFwiO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xudmFyIGlzVHlwZSA9IGZ1bmN0aW9uICh0eXBlLCB2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSB0eXBlO1xufTtcbmV4cG9ydHMuaXNUeXBlID0gaXNUeXBlO1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiBpc1R5cGUoXCJvYmplY3RcIiwgdmFsdWUpO1xufTtcbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcbnZhciBpc1N0cmluZyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gaXNUeXBlKFwic3RyaW5nXCIsIHZhbHVlKTtcbn07XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG52YXIgaXNOdW1iZXIgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIGlzVHlwZShcIm51bWJlclwiLCB2YWx1ZSk7XG59O1xuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kaXN0L2VudW0nKTtcbiIsIi8qIVxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBhIEJ1ZmZlclxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxuLy8gVGhlIF9pc0J1ZmZlciBjaGVjayBpcyBmb3IgU2FmYXJpIDUtNyBzdXBwb3J0LCBiZWNhdXNlIGl0J3MgbWlzc2luZ1xuLy8gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvci4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBvYmogIT0gbnVsbCAmJiAoaXNCdWZmZXIob2JqKSB8fCBpc1Nsb3dCdWZmZXIob2JqKSB8fCAhIW9iai5faXNCdWZmZXIpXG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyIChvYmopIHtcbiAgcmV0dXJuICEhb2JqLmNvbnN0cnVjdG9yICYmIHR5cGVvZiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iailcbn1cblxuLy8gRm9yIE5vZGUgdjAuMTAgc3VwcG9ydC4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseS5cbmZ1bmN0aW9uIGlzU2xvd0J1ZmZlciAob2JqKSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqLnJlYWRGbG9hdExFID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouc2xpY2UgPT09ICdmdW5jdGlvbicgJiYgaXNCdWZmZXIob2JqLnNsaWNlKDAsIDApKVxufVxuIiwiZXhwb3J0cy5lbmRpYW5uZXNzID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJ0xFJyB9O1xuXG5leHBvcnRzLmhvc3RuYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgbG9jYXRpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBsb2NhdGlvbi5ob3N0bmFtZVxuICAgIH1cbiAgICBlbHNlIHJldHVybiAnJztcbn07XG5cbmV4cG9ydHMubG9hZGF2ZyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtdIH07XG5cbmV4cG9ydHMudXB0aW1lID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gMCB9O1xuXG5leHBvcnRzLmZyZWVtZW0gPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE51bWJlci5NQVhfVkFMVUU7XG59O1xuXG5leHBvcnRzLnRvdGFsbWVtID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBOdW1iZXIuTUFYX1ZBTFVFO1xufTtcblxuZXhwb3J0cy5jcHVzID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gW10gfTtcblxuZXhwb3J0cy50eXBlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJ0Jyb3dzZXInIH07XG5cbmV4cG9ydHMucmVsZWFzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIG5hdmlnYXRvci5hcHBWZXJzaW9uO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG59O1xuXG5leHBvcnRzLm5ldHdvcmtJbnRlcmZhY2VzXG49IGV4cG9ydHMuZ2V0TmV0d29ya0ludGVyZmFjZXNcbj0gZnVuY3Rpb24gKCkgeyByZXR1cm4ge30gfTtcblxuZXhwb3J0cy5hcmNoID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJ2phdmFzY3JpcHQnIH07XG5cbmV4cG9ydHMucGxhdGZvcm0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnYnJvd3NlcicgfTtcblxuZXhwb3J0cy50bXBkaXIgPSBleHBvcnRzLnRtcERpciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJy90bXAnO1xufTtcblxuZXhwb3J0cy5FT0wgPSAnXFxuJztcbiJdfQ==
(5)
});
