#!/usr/bin/env node
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/uri-js/dist/es5/uri.all.js
var require_uri_all = __commonJS((exports, module) => {
  (function(global, factory) {
    typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : factory(global.URI = global.URI || {});
  })(exports, function(exports2) {
    function merge() {
      for (var _len = arguments.length, sets = Array(_len), _key = 0;_key < _len; _key++) {
        sets[_key] = arguments[_key];
      }
      if (sets.length > 1) {
        sets[0] = sets[0].slice(0, -1);
        var xl = sets.length - 1;
        for (var x = 1;x < xl; ++x) {
          sets[x] = sets[x].slice(1, -1);
        }
        sets[xl] = sets[xl].slice(1);
        return sets.join("");
      } else {
        return sets[0];
      }
    }
    function subexp(str) {
      return "(?:" + str + ")";
    }
    function typeOf(o) {
      return o === undefined ? "undefined" : o === null ? "null" : Object.prototype.toString.call(o).split(" ").pop().split("]").shift().toLowerCase();
    }
    function toUpperCase(str) {
      return str.toUpperCase();
    }
    function toArray(obj) {
      return obj !== undefined && obj !== null ? obj instanceof Array ? obj : typeof obj.length !== "number" || obj.split || obj.setInterval || obj.call ? [obj] : Array.prototype.slice.call(obj) : [];
    }
    function assign(target, source) {
      var obj = target;
      if (source) {
        for (var key in source) {
          obj[key] = source[key];
        }
      }
      return obj;
    }
    function buildExps(isIRI2) {
      var ALPHA$$ = "[A-Za-z]", CR$ = "[\\x0D]", DIGIT$$ = "[0-9]", DQUOTE$$ = "[\\x22]", HEXDIG$$2 = merge(DIGIT$$, "[A-Fa-f]"), LF$$ = "[\\x0A]", SP$$ = "[\\x20]", PCT_ENCODED$2 = subexp(subexp("%[EFef]" + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$2 + "%" + HEXDIG$$2 + HEXDIG$$2) + "|" + subexp("%" + HEXDIG$$2 + HEXDIG$$2)), GEN_DELIMS$$ = "[\\:\\/\\?\\#\\[\\]\\@]", SUB_DELIMS$$ = "[\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=]", RESERVED$$ = merge(GEN_DELIMS$$, SUB_DELIMS$$), UCSCHAR$$ = isIRI2 ? "[\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF]" : "[]", IPRIVATE$$ = isIRI2 ? "[\\uE000-\\uF8FF]" : "[]", UNRESERVED$$2 = merge(ALPHA$$, DIGIT$$, "[\\-\\.\\_\\~]", UCSCHAR$$), SCHEME$ = subexp(ALPHA$$ + merge(ALPHA$$, DIGIT$$, "[\\+\\-\\.]") + "*"), USERINFO$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:]")) + "*"), DEC_OCTET$ = subexp(subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" + subexp("1" + DIGIT$$ + DIGIT$$) + "|" + subexp("[1-9]" + DIGIT$$) + "|" + DIGIT$$), DEC_OCTET_RELAXED$ = subexp(subexp("25[0-5]") + "|" + subexp("2[0-4]" + DIGIT$$) + "|" + subexp("1" + DIGIT$$ + DIGIT$$) + "|" + subexp("0?[1-9]" + DIGIT$$) + "|0?0?" + DIGIT$$), IPV4ADDRESS$ = subexp(DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$ + "\\." + DEC_OCTET_RELAXED$), H16$ = subexp(HEXDIG$$2 + "{1,4}"), LS32$ = subexp(subexp(H16$ + "\\:" + H16$) + "|" + IPV4ADDRESS$), IPV6ADDRESS1$ = subexp(subexp(H16$ + "\\:") + "{6}" + LS32$), IPV6ADDRESS2$ = subexp("\\:\\:" + subexp(H16$ + "\\:") + "{5}" + LS32$), IPV6ADDRESS3$ = subexp(subexp(H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{4}" + LS32$), IPV6ADDRESS4$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,1}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{3}" + LS32$), IPV6ADDRESS5$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,2}" + H16$) + "?\\:\\:" + subexp(H16$ + "\\:") + "{2}" + LS32$), IPV6ADDRESS6$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,3}" + H16$) + "?\\:\\:" + H16$ + "\\:" + LS32$), IPV6ADDRESS7$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,4}" + H16$) + "?\\:\\:" + LS32$), IPV6ADDRESS8$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,5}" + H16$) + "?\\:\\:" + H16$), IPV6ADDRESS9$ = subexp(subexp(subexp(H16$ + "\\:") + "{0,6}" + H16$) + "?\\:\\:"), IPV6ADDRESS$ = subexp([IPV6ADDRESS1$, IPV6ADDRESS2$, IPV6ADDRESS3$, IPV6ADDRESS4$, IPV6ADDRESS5$, IPV6ADDRESS6$, IPV6ADDRESS7$, IPV6ADDRESS8$, IPV6ADDRESS9$].join("|")), ZONEID$ = subexp(subexp(UNRESERVED$$2 + "|" + PCT_ENCODED$2) + "+"), IPV6ADDRZ$ = subexp(IPV6ADDRESS$ + "\\%25" + ZONEID$), IPV6ADDRZ_RELAXED$ = subexp(IPV6ADDRESS$ + subexp("\\%25|\\%(?!" + HEXDIG$$2 + "{2})") + ZONEID$), IPVFUTURE$ = subexp("[vV]" + HEXDIG$$2 + "+\\." + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:]") + "+"), IP_LITERAL$ = subexp("\\[" + subexp(IPV6ADDRZ_RELAXED$ + "|" + IPV6ADDRESS$ + "|" + IPVFUTURE$) + "\\]"), REG_NAME$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$)) + "*"), HOST$ = subexp(IP_LITERAL$ + "|" + IPV4ADDRESS$ + "(?!" + REG_NAME$ + ")" + "|" + REG_NAME$), PORT$ = subexp(DIGIT$$ + "*"), AUTHORITY$ = subexp(subexp(USERINFO$ + "@") + "?" + HOST$ + subexp("\\:" + PORT$) + "?"), PCHAR$ = subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@]")), SEGMENT$ = subexp(PCHAR$ + "*"), SEGMENT_NZ$ = subexp(PCHAR$ + "+"), SEGMENT_NZ_NC$ = subexp(subexp(PCT_ENCODED$2 + "|" + merge(UNRESERVED$$2, SUB_DELIMS$$, "[\\@]")) + "+"), PATH_ABEMPTY$ = subexp(subexp("\\/" + SEGMENT$) + "*"), PATH_ABSOLUTE$ = subexp("\\/" + subexp(SEGMENT_NZ$ + PATH_ABEMPTY$) + "?"), PATH_NOSCHEME$ = subexp(SEGMENT_NZ_NC$ + PATH_ABEMPTY$), PATH_ROOTLESS$ = subexp(SEGMENT_NZ$ + PATH_ABEMPTY$), PATH_EMPTY$ = "(?!" + PCHAR$ + ")", PATH$ = subexp(PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$), QUERY$ = subexp(subexp(PCHAR$ + "|" + merge("[\\/\\?]", IPRIVATE$$)) + "*"), FRAGMENT$ = subexp(subexp(PCHAR$ + "|[\\/\\?]") + "*"), HIER_PART$ = subexp(subexp("\\/\\/" + AUTHORITY$ + PATH_ABEMPTY$) + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$), URI$ = subexp(SCHEME$ + "\\:" + HIER_PART$ + subexp("\\?" + QUERY$) + "?" + subexp("\\#" + FRAGMENT$) + "?"), RELATIVE_PART$ = subexp(subexp("\\/\\/" + AUTHORITY$ + PATH_ABEMPTY$) + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_EMPTY$), RELATIVE$ = subexp(RELATIVE_PART$ + subexp("\\?" + QUERY$) + "?" + subexp("\\#" + FRAGMENT$) + "?"), URI_REFERENCE$ = subexp(URI$ + "|" + RELATIVE$), ABSOLUTE_URI$ = subexp(SCHEME$ + "\\:" + HIER_PART$ + subexp("\\?" + QUERY$) + "?"), GENERIC_REF$ = "^(" + SCHEME$ + ")\\:" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", RELATIVE_REF$ = "^(){0}" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_NOSCHEME$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", ABSOLUTE_REF$ = "^(" + SCHEME$ + ")\\:" + subexp(subexp("\\/\\/(" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?)") + "?(" + PATH_ABEMPTY$ + "|" + PATH_ABSOLUTE$ + "|" + PATH_ROOTLESS$ + "|" + PATH_EMPTY$ + ")") + subexp("\\?(" + QUERY$ + ")") + "?$", SAMEDOC_REF$ = "^" + subexp("\\#(" + FRAGMENT$ + ")") + "?$", AUTHORITY_REF$ = "^" + subexp("(" + USERINFO$ + ")@") + "?(" + HOST$ + ")" + subexp("\\:(" + PORT$ + ")") + "?$";
      return {
        NOT_SCHEME: new RegExp(merge("[^]", ALPHA$$, DIGIT$$, "[\\+\\-\\.]"), "g"),
        NOT_USERINFO: new RegExp(merge("[^\\%\\:]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
        NOT_HOST: new RegExp(merge("[^\\%\\[\\]\\:]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
        NOT_PATH: new RegExp(merge("[^\\%\\/\\:\\@]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
        NOT_PATH_NOSCHEME: new RegExp(merge("[^\\%\\/\\@]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
        NOT_QUERY: new RegExp(merge("[^\\%]", UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@\\/\\?]", IPRIVATE$$), "g"),
        NOT_FRAGMENT: new RegExp(merge("[^\\%]", UNRESERVED$$2, SUB_DELIMS$$, "[\\:\\@\\/\\?]"), "g"),
        ESCAPE: new RegExp(merge("[^]", UNRESERVED$$2, SUB_DELIMS$$), "g"),
        UNRESERVED: new RegExp(UNRESERVED$$2, "g"),
        OTHER_CHARS: new RegExp(merge("[^\\%]", UNRESERVED$$2, RESERVED$$), "g"),
        PCT_ENCODED: new RegExp(PCT_ENCODED$2, "g"),
        IPV4ADDRESS: new RegExp("^(" + IPV4ADDRESS$ + ")$"),
        IPV6ADDRESS: new RegExp("^\\[?(" + IPV6ADDRESS$ + ")" + subexp(subexp("\\%25|\\%(?!" + HEXDIG$$2 + "{2})") + "(" + ZONEID$ + ")") + "?\\]?$")
      };
    }
    var URI_PROTOCOL = buildExps(false);
    var IRI_PROTOCOL = buildExps(true);
    var slicedToArray = function() {
      function sliceIterator(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e = undefined;
        try {
          for (var _i = arr[Symbol.iterator](), _s;!(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i)
              break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"])
              _i["return"]();
          } finally {
            if (_d)
              throw _e;
          }
        }
        return _arr;
      }
      return function(arr, i) {
        if (Array.isArray(arr)) {
          return arr;
        } else if (Symbol.iterator in Object(arr)) {
          return sliceIterator(arr, i);
        } else {
          throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
      };
    }();
    var toConsumableArray = function(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length);i < arr.length; i++)
          arr2[i] = arr[i];
        return arr2;
      } else {
        return Array.from(arr);
      }
    };
    var maxInt = 2147483647;
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128;
    var delimiter = "-";
    var regexPunycode = /^xn--/;
    var regexNonASCII = /[^\0-\x7E]/;
    var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
    var errors = {
      overflow: "Overflow: input needs wider integers to process",
      "not-basic": "Illegal input >= 0x80 (not a basic code point)",
      "invalid-input": "Invalid input"
    };
    var baseMinusTMin = base - tMin;
    var floor = Math.floor;
    var stringFromCharCode = String.fromCharCode;
    function error$1(type) {
      throw new RangeError(errors[type]);
    }
    function map(array, fn) {
      var result = [];
      var length = array.length;
      while (length--) {
        result[length] = fn(array[length]);
      }
      return result;
    }
    function mapDomain(string, fn) {
      var parts = string.split("@");
      var result = "";
      if (parts.length > 1) {
        result = parts[0] + "@";
        string = parts[1];
      }
      string = string.replace(regexSeparators, ".");
      var labels = string.split(".");
      var encoded = map(labels, fn).join(".");
      return result + encoded;
    }
    function ucs2decode(string) {
      var output = [];
      var counter = 0;
      var length = string.length;
      while (counter < length) {
        var value = string.charCodeAt(counter++);
        if (value >= 55296 && value <= 56319 && counter < length) {
          var extra = string.charCodeAt(counter++);
          if ((extra & 64512) == 56320) {
            output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
          } else {
            output.push(value);
            counter--;
          }
        } else {
          output.push(value);
        }
      }
      return output;
    }
    var ucs2encode = function ucs2encode(array) {
      return String.fromCodePoint.apply(String, toConsumableArray(array));
    };
    var basicToDigit = function basicToDigit(codePoint) {
      if (codePoint - 48 < 10) {
        return codePoint - 22;
      }
      if (codePoint - 65 < 26) {
        return codePoint - 65;
      }
      if (codePoint - 97 < 26) {
        return codePoint - 97;
      }
      return base;
    };
    var digitToBasic = function digitToBasic(digit, flag) {
      return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
    };
    var adapt = function adapt(delta, numPoints, firstTime) {
      var k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      for (;delta > baseMinusTMin * tMax >> 1; k += base) {
        delta = floor(delta / baseMinusTMin);
      }
      return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
    };
    var decode = function decode(input) {
      var output = [];
      var inputLength = input.length;
      var i = 0;
      var n = initialN;
      var bias = initialBias;
      var basic = input.lastIndexOf(delimiter);
      if (basic < 0) {
        basic = 0;
      }
      for (var j = 0;j < basic; ++j) {
        if (input.charCodeAt(j) >= 128) {
          error$1("not-basic");
        }
        output.push(input.charCodeAt(j));
      }
      for (var index = basic > 0 ? basic + 1 : 0;index < inputLength; ) {
        var oldi = i;
        for (var w = 1, k = base;; k += base) {
          if (index >= inputLength) {
            error$1("invalid-input");
          }
          var digit = basicToDigit(input.charCodeAt(index++));
          if (digit >= base || digit > floor((maxInt - i) / w)) {
            error$1("overflow");
          }
          i += digit * w;
          var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (digit < t) {
            break;
          }
          var baseMinusT = base - t;
          if (w > floor(maxInt / baseMinusT)) {
            error$1("overflow");
          }
          w *= baseMinusT;
        }
        var out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);
        if (floor(i / out) > maxInt - n) {
          error$1("overflow");
        }
        n += floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint.apply(String, output);
    };
    var encode = function encode(input) {
      var output = [];
      input = ucs2decode(input);
      var inputLength = input.length;
      var n = initialN;
      var delta = 0;
      var bias = initialBias;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;
      try {
        for (var _iterator = input[Symbol.iterator](), _step;!(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _currentValue2 = _step.value;
          if (_currentValue2 < 128) {
            output.push(stringFromCharCode(_currentValue2));
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
      var basicLength = output.length;
      var handledCPCount = basicLength;
      if (basicLength) {
        output.push(delimiter);
      }
      while (handledCPCount < inputLength) {
        var m = maxInt;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;
        try {
          for (var _iterator2 = input[Symbol.iterator](), _step2;!(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var currentValue = _step2.value;
            if (currentValue >= n && currentValue < m) {
              m = currentValue;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
        var handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          error$1("overflow");
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;
        try {
          for (var _iterator3 = input[Symbol.iterator](), _step3;!(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var _currentValue = _step3.value;
            if (_currentValue < n && ++delta > maxInt) {
              error$1("overflow");
            }
            if (_currentValue == n) {
              var q = delta;
              for (var k = base;; k += base) {
                var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                if (q < t) {
                  break;
                }
                var qMinusT = q - t;
                var baseMinusT = base - t;
                output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                q = floor(qMinusT / baseMinusT);
              }
              output.push(stringFromCharCode(digitToBasic(q, 0)));
              bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
              delta = 0;
              ++handledCPCount;
            }
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
        ++delta;
        ++n;
      }
      return output.join("");
    };
    var toUnicode = function toUnicode(input) {
      return mapDomain(input, function(string) {
        return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
      });
    };
    var toASCII = function toASCII(input) {
      return mapDomain(input, function(string) {
        return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
      });
    };
    var punycode = {
      version: "2.1.0",
      ucs2: {
        decode: ucs2decode,
        encode: ucs2encode
      },
      decode,
      encode,
      toASCII,
      toUnicode
    };
    var SCHEMES = {};
    function pctEncChar(chr) {
      var c = chr.charCodeAt(0);
      var e = undefined;
      if (c < 16)
        e = "%0" + c.toString(16).toUpperCase();
      else if (c < 128)
        e = "%" + c.toString(16).toUpperCase();
      else if (c < 2048)
        e = "%" + (c >> 6 | 192).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase();
      else
        e = "%" + (c >> 12 | 224).toString(16).toUpperCase() + "%" + (c >> 6 & 63 | 128).toString(16).toUpperCase() + "%" + (c & 63 | 128).toString(16).toUpperCase();
      return e;
    }
    function pctDecChars(str) {
      var newStr = "";
      var i = 0;
      var il = str.length;
      while (i < il) {
        var c = parseInt(str.substr(i + 1, 2), 16);
        if (c < 128) {
          newStr += String.fromCharCode(c);
          i += 3;
        } else if (c >= 194 && c < 224) {
          if (il - i >= 6) {
            var c2 = parseInt(str.substr(i + 4, 2), 16);
            newStr += String.fromCharCode((c & 31) << 6 | c2 & 63);
          } else {
            newStr += str.substr(i, 6);
          }
          i += 6;
        } else if (c >= 224) {
          if (il - i >= 9) {
            var _c = parseInt(str.substr(i + 4, 2), 16);
            var c3 = parseInt(str.substr(i + 7, 2), 16);
            newStr += String.fromCharCode((c & 15) << 12 | (_c & 63) << 6 | c3 & 63);
          } else {
            newStr += str.substr(i, 9);
          }
          i += 9;
        } else {
          newStr += str.substr(i, 3);
          i += 3;
        }
      }
      return newStr;
    }
    function _normalizeComponentEncoding(components, protocol) {
      function decodeUnreserved2(str) {
        var decStr = pctDecChars(str);
        return !decStr.match(protocol.UNRESERVED) ? str : decStr;
      }
      if (components.scheme)
        components.scheme = String(components.scheme).replace(protocol.PCT_ENCODED, decodeUnreserved2).toLowerCase().replace(protocol.NOT_SCHEME, "");
      if (components.userinfo !== undefined)
        components.userinfo = String(components.userinfo).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_USERINFO, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
      if (components.host !== undefined)
        components.host = String(components.host).replace(protocol.PCT_ENCODED, decodeUnreserved2).toLowerCase().replace(protocol.NOT_HOST, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
      if (components.path !== undefined)
        components.path = String(components.path).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(components.scheme ? protocol.NOT_PATH : protocol.NOT_PATH_NOSCHEME, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
      if (components.query !== undefined)
        components.query = String(components.query).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_QUERY, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
      if (components.fragment !== undefined)
        components.fragment = String(components.fragment).replace(protocol.PCT_ENCODED, decodeUnreserved2).replace(protocol.NOT_FRAGMENT, pctEncChar).replace(protocol.PCT_ENCODED, toUpperCase);
      return components;
    }
    function _stripLeadingZeros(str) {
      return str.replace(/^0*(.*)/, "$1") || "0";
    }
    function _normalizeIPv4(host, protocol) {
      var matches = host.match(protocol.IPV4ADDRESS) || [];
      var _matches = slicedToArray(matches, 2), address = _matches[1];
      if (address) {
        return address.split(".").map(_stripLeadingZeros).join(".");
      } else {
        return host;
      }
    }
    function _normalizeIPv6(host, protocol) {
      var matches = host.match(protocol.IPV6ADDRESS) || [];
      var _matches2 = slicedToArray(matches, 3), address = _matches2[1], zone = _matches2[2];
      if (address) {
        var _address$toLowerCase$ = address.toLowerCase().split("::").reverse(), _address$toLowerCase$2 = slicedToArray(_address$toLowerCase$, 2), last = _address$toLowerCase$2[0], first = _address$toLowerCase$2[1];
        var firstFields = first ? first.split(":").map(_stripLeadingZeros) : [];
        var lastFields = last.split(":").map(_stripLeadingZeros);
        var isLastFieldIPv4Address = protocol.IPV4ADDRESS.test(lastFields[lastFields.length - 1]);
        var fieldCount = isLastFieldIPv4Address ? 7 : 8;
        var lastFieldsStart = lastFields.length - fieldCount;
        var fields = Array(fieldCount);
        for (var x = 0;x < fieldCount; ++x) {
          fields[x] = firstFields[x] || lastFields[lastFieldsStart + x] || "";
        }
        if (isLastFieldIPv4Address) {
          fields[fieldCount - 1] = _normalizeIPv4(fields[fieldCount - 1], protocol);
        }
        var allZeroFields = fields.reduce(function(acc, field, index) {
          if (!field || field === "0") {
            var lastLongest = acc[acc.length - 1];
            if (lastLongest && lastLongest.index + lastLongest.length === index) {
              lastLongest.length++;
            } else {
              acc.push({ index, length: 1 });
            }
          }
          return acc;
        }, []);
        var longestZeroFields = allZeroFields.sort(function(a, b) {
          return b.length - a.length;
        })[0];
        var newHost = undefined;
        if (longestZeroFields && longestZeroFields.length > 1) {
          var newFirst = fields.slice(0, longestZeroFields.index);
          var newLast = fields.slice(longestZeroFields.index + longestZeroFields.length);
          newHost = newFirst.join(":") + "::" + newLast.join(":");
        } else {
          newHost = fields.join(":");
        }
        if (zone) {
          newHost += "%" + zone;
        }
        return newHost;
      } else {
        return host;
      }
    }
    var URI_PARSE = /^(?:([^:\/?#]+):)?(?:\/\/((?:([^\/?#@]*)@)?(\[[^\/?#\]]+\]|[^\/?#:]*)(?:\:(\d*))?))?([^?#]*)(?:\?([^#]*))?(?:#((?:.|\n|\r)*))?/i;
    var NO_MATCH_IS_UNDEFINED = "".match(/(){0}/)[1] === undefined;
    function parse(uriString) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var components = {};
      var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
      if (options.reference === "suffix")
        uriString = (options.scheme ? options.scheme + ":" : "") + "//" + uriString;
      var matches = uriString.match(URI_PARSE);
      if (matches) {
        if (NO_MATCH_IS_UNDEFINED) {
          components.scheme = matches[1];
          components.userinfo = matches[3];
          components.host = matches[4];
          components.port = parseInt(matches[5], 10);
          components.path = matches[6] || "";
          components.query = matches[7];
          components.fragment = matches[8];
          if (isNaN(components.port)) {
            components.port = matches[5];
          }
        } else {
          components.scheme = matches[1] || undefined;
          components.userinfo = uriString.indexOf("@") !== -1 ? matches[3] : undefined;
          components.host = uriString.indexOf("//") !== -1 ? matches[4] : undefined;
          components.port = parseInt(matches[5], 10);
          components.path = matches[6] || "";
          components.query = uriString.indexOf("?") !== -1 ? matches[7] : undefined;
          components.fragment = uriString.indexOf("#") !== -1 ? matches[8] : undefined;
          if (isNaN(components.port)) {
            components.port = uriString.match(/\/\/(?:.|\n)*\:(?:\/|\?|\#|$)/) ? matches[4] : undefined;
          }
        }
        if (components.host) {
          components.host = _normalizeIPv6(_normalizeIPv4(components.host, protocol), protocol);
        }
        if (components.scheme === undefined && components.userinfo === undefined && components.host === undefined && components.port === undefined && !components.path && components.query === undefined) {
          components.reference = "same-document";
        } else if (components.scheme === undefined) {
          components.reference = "relative";
        } else if (components.fragment === undefined) {
          components.reference = "absolute";
        } else {
          components.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== components.reference) {
          components.error = components.error || "URI is not a " + options.reference + " reference.";
        }
        var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (components.host && (options.domainHost || schemeHandler && schemeHandler.domainHost)) {
            try {
              components.host = punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase());
            } catch (e) {
              components.error = components.error || "Host's domain name can not be converted to ASCII via punycode: " + e;
            }
          }
          _normalizeComponentEncoding(components, URI_PROTOCOL);
        } else {
          _normalizeComponentEncoding(components, protocol);
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(components, options);
        }
      } else {
        components.error = components.error || "URI can not be parsed.";
      }
      return components;
    }
    function _recomposeAuthority(components, options) {
      var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
      var uriTokens = [];
      if (components.userinfo !== undefined) {
        uriTokens.push(components.userinfo);
        uriTokens.push("@");
      }
      if (components.host !== undefined) {
        uriTokens.push(_normalizeIPv6(_normalizeIPv4(String(components.host), protocol), protocol).replace(protocol.IPV6ADDRESS, function(_, $1, $2) {
          return "[" + $1 + ($2 ? "%25" + $2 : "") + "]";
        }));
      }
      if (typeof components.port === "number" || typeof components.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(components.port));
      }
      return uriTokens.length ? uriTokens.join("") : undefined;
    }
    var RDS1 = /^\.\.?\//;
    var RDS2 = /^\/\.(\/|$)/;
    var RDS3 = /^\/\.\.(\/|$)/;
    var RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/;
    function removeDotSegments(input) {
      var output = [];
      while (input.length) {
        if (input.match(RDS1)) {
          input = input.replace(RDS1, "");
        } else if (input.match(RDS2)) {
          input = input.replace(RDS2, "/");
        } else if (input.match(RDS3)) {
          input = input.replace(RDS3, "/");
          output.pop();
        } else if (input === "." || input === "..") {
          input = "";
        } else {
          var im = input.match(RDS5);
          if (im) {
            var s = im[0];
            input = input.slice(s.length);
            output.push(s);
          } else {
            throw new Error("Unexpected dot segment condition");
          }
        }
      }
      return output.join("");
    }
    function serialize(components) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var protocol = options.iri ? IRI_PROTOCOL : URI_PROTOCOL;
      var uriTokens = [];
      var schemeHandler = SCHEMES[(options.scheme || components.scheme || "").toLowerCase()];
      if (schemeHandler && schemeHandler.serialize)
        schemeHandler.serialize(components, options);
      if (components.host) {
        if (protocol.IPV6ADDRESS.test(components.host)) {} else if (options.domainHost || schemeHandler && schemeHandler.domainHost) {
          try {
            components.host = !options.iri ? punycode.toASCII(components.host.replace(protocol.PCT_ENCODED, pctDecChars).toLowerCase()) : punycode.toUnicode(components.host);
          } catch (e) {
            components.error = components.error || "Host's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
          }
        }
      }
      _normalizeComponentEncoding(components, protocol);
      if (options.reference !== "suffix" && components.scheme) {
        uriTokens.push(components.scheme);
        uriTokens.push(":");
      }
      var authority = _recomposeAuthority(components, options);
      if (authority !== undefined) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (components.path && components.path.charAt(0) !== "/") {
          uriTokens.push("/");
        }
      }
      if (components.path !== undefined) {
        var s = components.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === undefined) {
          s = s.replace(/^\/\//, "/%2F");
        }
        uriTokens.push(s);
      }
      if (components.query !== undefined) {
        uriTokens.push("?");
        uriTokens.push(components.query);
      }
      if (components.fragment !== undefined) {
        uriTokens.push("#");
        uriTokens.push(components.fragment);
      }
      return uriTokens.join("");
    }
    function resolveComponents(base2, relative) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var skipNormalization = arguments[3];
      var target = {};
      if (!skipNormalization) {
        base2 = parse(serialize(base2, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== undefined || relative.host !== undefined || relative.port !== undefined) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base2.path;
            if (relative.query !== undefined) {
              target.query = relative.query;
            } else {
              target.query = base2.query;
            }
          } else {
            if (relative.path.charAt(0) === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base2.userinfo !== undefined || base2.host !== undefined || base2.port !== undefined) && !base2.path) {
                target.path = "/" + relative.path;
              } else if (!base2.path) {
                target.path = relative.path;
              } else {
                target.path = base2.path.slice(0, base2.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base2.userinfo;
          target.host = base2.host;
          target.port = base2.port;
        }
        target.scheme = base2.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function resolve(baseURI, relativeURI, options) {
      var schemelessOptions = assign({ scheme: "null" }, options);
      return serialize(resolveComponents(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true), schemelessOptions);
    }
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = serialize(parse(uri, options), options);
      } else if (typeOf(uri) === "object") {
        uri = parse(serialize(uri, options), options);
      }
      return uri;
    }
    function equal(uriA, uriB, options) {
      if (typeof uriA === "string") {
        uriA = serialize(parse(uriA, options), options);
      } else if (typeOf(uriA) === "object") {
        uriA = serialize(uriA, options);
      }
      if (typeof uriB === "string") {
        uriB = serialize(parse(uriB, options), options);
      } else if (typeOf(uriB) === "object") {
        uriB = serialize(uriB, options);
      }
      return uriA === uriB;
    }
    function escapeComponent(str, options) {
      return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.ESCAPE : IRI_PROTOCOL.ESCAPE, pctEncChar);
    }
    function unescapeComponent(str, options) {
      return str && str.toString().replace(!options || !options.iri ? URI_PROTOCOL.PCT_ENCODED : IRI_PROTOCOL.PCT_ENCODED, pctDecChars);
    }
    var handler = {
      scheme: "http",
      domainHost: true,
      parse: function parse(components, options) {
        if (!components.host) {
          components.error = components.error || "HTTP URIs must have a host.";
        }
        return components;
      },
      serialize: function serialize(components, options) {
        var secure = String(components.scheme).toLowerCase() === "https";
        if (components.port === (secure ? 443 : 80) || components.port === "") {
          components.port = undefined;
        }
        if (!components.path) {
          components.path = "/";
        }
        return components;
      }
    };
    var handler$1 = {
      scheme: "https",
      domainHost: handler.domainHost,
      parse: handler.parse,
      serialize: handler.serialize
    };
    function isSecure(wsComponents) {
      return typeof wsComponents.secure === "boolean" ? wsComponents.secure : String(wsComponents.scheme).toLowerCase() === "wss";
    }
    var handler$2 = {
      scheme: "ws",
      domainHost: true,
      parse: function parse(components, options) {
        var wsComponents = components;
        wsComponents.secure = isSecure(wsComponents);
        wsComponents.resourceName = (wsComponents.path || "/") + (wsComponents.query ? "?" + wsComponents.query : "");
        wsComponents.path = undefined;
        wsComponents.query = undefined;
        return wsComponents;
      },
      serialize: function serialize(wsComponents, options) {
        if (wsComponents.port === (isSecure(wsComponents) ? 443 : 80) || wsComponents.port === "") {
          wsComponents.port = undefined;
        }
        if (typeof wsComponents.secure === "boolean") {
          wsComponents.scheme = wsComponents.secure ? "wss" : "ws";
          wsComponents.secure = undefined;
        }
        if (wsComponents.resourceName) {
          var _wsComponents$resourc = wsComponents.resourceName.split("?"), _wsComponents$resourc2 = slicedToArray(_wsComponents$resourc, 2), path = _wsComponents$resourc2[0], query = _wsComponents$resourc2[1];
          wsComponents.path = path && path !== "/" ? path : undefined;
          wsComponents.query = query;
          wsComponents.resourceName = undefined;
        }
        wsComponents.fragment = undefined;
        return wsComponents;
      }
    };
    var handler$3 = {
      scheme: "wss",
      domainHost: handler$2.domainHost,
      parse: handler$2.parse,
      serialize: handler$2.serialize
    };
    var O = {};
    var isIRI = true;
    var UNRESERVED$$ = "[A-Za-z0-9\\-\\.\\_\\~" + (isIRI ? "\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF" : "") + "]";
    var HEXDIG$$ = "[0-9A-Fa-f]";
    var PCT_ENCODED$ = subexp(subexp("%[EFef]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%[89A-Fa-f]" + HEXDIG$$ + "%" + HEXDIG$$ + HEXDIG$$) + "|" + subexp("%" + HEXDIG$$ + HEXDIG$$));
    var ATEXT$$ = "[A-Za-z0-9\\!\\$\\%\\'\\*\\+\\-\\^\\_\\`\\{\\|\\}\\~]";
    var QTEXT$$ = "[\\!\\$\\%\\'\\(\\)\\*\\+\\,\\-\\.0-9\\<\\>A-Z\\x5E-\\x7E]";
    var VCHAR$$ = merge(QTEXT$$, "[\\\"\\\\]");
    var SOME_DELIMS$$ = "[\\!\\$\\'\\(\\)\\*\\+\\,\\;\\:\\@]";
    var UNRESERVED = new RegExp(UNRESERVED$$, "g");
    var PCT_ENCODED = new RegExp(PCT_ENCODED$, "g");
    var NOT_LOCAL_PART = new RegExp(merge("[^]", ATEXT$$, "[\\.]", "[\\\"]", VCHAR$$), "g");
    var NOT_HFNAME = new RegExp(merge("[^]", UNRESERVED$$, SOME_DELIMS$$), "g");
    var NOT_HFVALUE = NOT_HFNAME;
    function decodeUnreserved(str) {
      var decStr = pctDecChars(str);
      return !decStr.match(UNRESERVED) ? str : decStr;
    }
    var handler$4 = {
      scheme: "mailto",
      parse: function parse$$1(components, options) {
        var mailtoComponents = components;
        var to = mailtoComponents.to = mailtoComponents.path ? mailtoComponents.path.split(",") : [];
        mailtoComponents.path = undefined;
        if (mailtoComponents.query) {
          var unknownHeaders = false;
          var headers = {};
          var hfields = mailtoComponents.query.split("&");
          for (var x = 0, xl = hfields.length;x < xl; ++x) {
            var hfield = hfields[x].split("=");
            switch (hfield[0]) {
              case "to":
                var toAddrs = hfield[1].split(",");
                for (var _x = 0, _xl = toAddrs.length;_x < _xl; ++_x) {
                  to.push(toAddrs[_x]);
                }
                break;
              case "subject":
                mailtoComponents.subject = unescapeComponent(hfield[1], options);
                break;
              case "body":
                mailtoComponents.body = unescapeComponent(hfield[1], options);
                break;
              default:
                unknownHeaders = true;
                headers[unescapeComponent(hfield[0], options)] = unescapeComponent(hfield[1], options);
                break;
            }
          }
          if (unknownHeaders)
            mailtoComponents.headers = headers;
        }
        mailtoComponents.query = undefined;
        for (var _x2 = 0, _xl2 = to.length;_x2 < _xl2; ++_x2) {
          var addr = to[_x2].split("@");
          addr[0] = unescapeComponent(addr[0]);
          if (!options.unicodeSupport) {
            try {
              addr[1] = punycode.toASCII(unescapeComponent(addr[1], options).toLowerCase());
            } catch (e) {
              mailtoComponents.error = mailtoComponents.error || "Email address's domain name can not be converted to ASCII via punycode: " + e;
            }
          } else {
            addr[1] = unescapeComponent(addr[1], options).toLowerCase();
          }
          to[_x2] = addr.join("@");
        }
        return mailtoComponents;
      },
      serialize: function serialize$$1(mailtoComponents, options) {
        var components = mailtoComponents;
        var to = toArray(mailtoComponents.to);
        if (to) {
          for (var x = 0, xl = to.length;x < xl; ++x) {
            var toAddr = String(to[x]);
            var atIdx = toAddr.lastIndexOf("@");
            var localPart = toAddr.slice(0, atIdx).replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_LOCAL_PART, pctEncChar);
            var domain = toAddr.slice(atIdx + 1);
            try {
              domain = !options.iri ? punycode.toASCII(unescapeComponent(domain, options).toLowerCase()) : punycode.toUnicode(domain);
            } catch (e) {
              components.error = components.error || "Email address's domain name can not be converted to " + (!options.iri ? "ASCII" : "Unicode") + " via punycode: " + e;
            }
            to[x] = localPart + "@" + domain;
          }
          components.path = to.join(",");
        }
        var headers = mailtoComponents.headers = mailtoComponents.headers || {};
        if (mailtoComponents.subject)
          headers["subject"] = mailtoComponents.subject;
        if (mailtoComponents.body)
          headers["body"] = mailtoComponents.body;
        var fields = [];
        for (var name in headers) {
          if (headers[name] !== O[name]) {
            fields.push(name.replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFNAME, pctEncChar) + "=" + headers[name].replace(PCT_ENCODED, decodeUnreserved).replace(PCT_ENCODED, toUpperCase).replace(NOT_HFVALUE, pctEncChar));
          }
        }
        if (fields.length) {
          components.query = fields.join("&");
        }
        return components;
      }
    };
    var URN_PARSE = /^([^\:]+)\:(.*)/;
    var handler$5 = {
      scheme: "urn",
      parse: function parse$$1(components, options) {
        var matches = components.path && components.path.match(URN_PARSE);
        var urnComponents = components;
        if (matches) {
          var scheme = options.scheme || urnComponents.scheme || "urn";
          var nid = matches[1].toLowerCase();
          var nss = matches[2];
          var urnScheme = scheme + ":" + (options.nid || nid);
          var schemeHandler = SCHEMES[urnScheme];
          urnComponents.nid = nid;
          urnComponents.nss = nss;
          urnComponents.path = undefined;
          if (schemeHandler) {
            urnComponents = schemeHandler.parse(urnComponents, options);
          }
        } else {
          urnComponents.error = urnComponents.error || "URN can not be parsed.";
        }
        return urnComponents;
      },
      serialize: function serialize$$1(urnComponents, options) {
        var scheme = options.scheme || urnComponents.scheme || "urn";
        var nid = urnComponents.nid;
        var urnScheme = scheme + ":" + (options.nid || nid);
        var schemeHandler = SCHEMES[urnScheme];
        if (schemeHandler) {
          urnComponents = schemeHandler.serialize(urnComponents, options);
        }
        var uriComponents = urnComponents;
        var nss = urnComponents.nss;
        uriComponents.path = (nid || options.nid) + ":" + nss;
        return uriComponents;
      }
    };
    var UUID = /^[0-9A-Fa-f]{8}(?:\-[0-9A-Fa-f]{4}){3}\-[0-9A-Fa-f]{12}$/;
    var handler$6 = {
      scheme: "urn:uuid",
      parse: function parse(urnComponents, options) {
        var uuidComponents = urnComponents;
        uuidComponents.uuid = uuidComponents.nss;
        uuidComponents.nss = undefined;
        if (!options.tolerant && (!uuidComponents.uuid || !uuidComponents.uuid.match(UUID))) {
          uuidComponents.error = uuidComponents.error || "UUID is not valid.";
        }
        return uuidComponents;
      },
      serialize: function serialize(uuidComponents, options) {
        var urnComponents = uuidComponents;
        urnComponents.nss = (uuidComponents.uuid || "").toLowerCase();
        return urnComponents;
      }
    };
    SCHEMES[handler.scheme] = handler;
    SCHEMES[handler$1.scheme] = handler$1;
    SCHEMES[handler$2.scheme] = handler$2;
    SCHEMES[handler$3.scheme] = handler$3;
    SCHEMES[handler$4.scheme] = handler$4;
    SCHEMES[handler$5.scheme] = handler$5;
    SCHEMES[handler$6.scheme] = handler$6;
    exports2.SCHEMES = SCHEMES;
    exports2.pctEncChar = pctEncChar;
    exports2.pctDecChars = pctDecChars;
    exports2.parse = parse;
    exports2.removeDotSegments = removeDotSegments;
    exports2.serialize = serialize;
    exports2.resolveComponents = resolveComponents;
    exports2.resolve = resolve;
    exports2.normalize = normalize;
    exports2.equal = equal;
    exports2.escapeComponent = escapeComponent;
    exports2.unescapeComponent = unescapeComponent;
    Object.defineProperty(exports2, "__esModule", { value: true });
  });
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS((exports, module) => {
  module.exports = function equal(a, b) {
    if (a === b)
      return true;
    if (a && b && typeof a == "object" && typeof b == "object") {
      if (a.constructor !== b.constructor)
        return false;
      var length, i, keys;
      if (Array.isArray(a)) {
        length = a.length;
        if (length != b.length)
          return false;
        for (i = length;i-- !== 0; )
          if (!equal(a[i], b[i]))
            return false;
        return true;
      }
      if (a.constructor === RegExp)
        return a.source === b.source && a.flags === b.flags;
      if (a.valueOf !== Object.prototype.valueOf)
        return a.valueOf() === b.valueOf();
      if (a.toString !== Object.prototype.toString)
        return a.toString() === b.toString();
      keys = Object.keys(a);
      length = keys.length;
      if (length !== Object.keys(b).length)
        return false;
      for (i = length;i-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
          return false;
      for (i = length;i-- !== 0; ) {
        var key = keys[i];
        if (!equal(a[key], b[key]))
          return false;
      }
      return true;
    }
    return a !== a && b !== b;
  };
});

// node_modules/ajv/lib/compile/ucs2length.js
var require_ucs2length = __commonJS((exports, module) => {
  module.exports = function ucs2length(str) {
    var length = 0, len = str.length, pos = 0, value;
    while (pos < len) {
      length++;
      value = str.charCodeAt(pos++);
      if (value >= 55296 && value <= 56319 && pos < len) {
        value = str.charCodeAt(pos);
        if ((value & 64512) == 56320)
          pos++;
      }
    }
    return length;
  };
});

// node_modules/ajv/lib/compile/util.js
var require_util = __commonJS((exports, module) => {
  module.exports = {
    copy,
    checkDataType,
    checkDataTypes,
    coerceToTypes,
    toHash,
    getProperty,
    escapeQuotes,
    equal: require_fast_deep_equal(),
    ucs2length: require_ucs2length(),
    varOccurences,
    varReplace,
    schemaHasRules,
    schemaHasRulesExcept,
    schemaUnknownRules,
    toQuotedString,
    getPathExpr,
    getPath,
    getData,
    unescapeFragment,
    unescapeJsonPointer,
    escapeFragment,
    escapeJsonPointer
  };
  function copy(o, to) {
    to = to || {};
    for (var key in o)
      to[key] = o[key];
    return to;
  }
  function checkDataType(dataType, data, strictNumbers, negate) {
    var EQUAL = negate ? " !== " : " === ", AND = negate ? " || " : " && ", OK2 = negate ? "!" : "", NOT = negate ? "" : "!";
    switch (dataType) {
      case "null":
        return data + EQUAL + "null";
      case "array":
        return OK2 + "Array.isArray(" + data + ")";
      case "object":
        return "(" + OK2 + data + AND + "typeof " + data + EQUAL + '"object"' + AND + NOT + "Array.isArray(" + data + "))";
      case "integer":
        return "(typeof " + data + EQUAL + '"number"' + AND + NOT + "(" + data + " % 1)" + AND + data + EQUAL + data + (strictNumbers ? AND + OK2 + "isFinite(" + data + ")" : "") + ")";
      case "number":
        return "(typeof " + data + EQUAL + '"' + dataType + '"' + (strictNumbers ? AND + OK2 + "isFinite(" + data + ")" : "") + ")";
      default:
        return "typeof " + data + EQUAL + '"' + dataType + '"';
    }
  }
  function checkDataTypes(dataTypes, data, strictNumbers) {
    switch (dataTypes.length) {
      case 1:
        return checkDataType(dataTypes[0], data, strictNumbers, true);
      default:
        var code = "";
        var types = toHash(dataTypes);
        if (types.array && types.object) {
          code = types.null ? "(" : "(!" + data + " || ";
          code += "typeof " + data + ' !== "object")';
          delete types.null;
          delete types.array;
          delete types.object;
        }
        if (types.number)
          delete types.integer;
        for (var t in types)
          code += (code ? " && " : "") + checkDataType(t, data, strictNumbers, true);
        return code;
    }
  }
  var COERCE_TO_TYPES = toHash(["string", "number", "integer", "boolean", "null"]);
  function coerceToTypes(optionCoerceTypes, dataTypes) {
    if (Array.isArray(dataTypes)) {
      var types = [];
      for (var i = 0;i < dataTypes.length; i++) {
        var t = dataTypes[i];
        if (COERCE_TO_TYPES[t])
          types[types.length] = t;
        else if (optionCoerceTypes === "array" && t === "array")
          types[types.length] = t;
      }
      if (types.length)
        return types;
    } else if (COERCE_TO_TYPES[dataTypes]) {
      return [dataTypes];
    } else if (optionCoerceTypes === "array" && dataTypes === "array") {
      return ["array"];
    }
  }
  function toHash(arr) {
    var hash = {};
    for (var i = 0;i < arr.length; i++)
      hash[arr[i]] = true;
    return hash;
  }
  var IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
  var SINGLE_QUOTE = /'|\\/g;
  function getProperty(key) {
    return typeof key == "number" ? "[" + key + "]" : IDENTIFIER.test(key) ? "." + key : "['" + escapeQuotes(key) + "']";
  }
  function escapeQuotes(str) {
    return str.replace(SINGLE_QUOTE, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\f/g, "\\f").replace(/\t/g, "\\t");
  }
  function varOccurences(str, dataVar) {
    dataVar += "[^0-9]";
    var matches = str.match(new RegExp(dataVar, "g"));
    return matches ? matches.length : 0;
  }
  function varReplace(str, dataVar, expr) {
    dataVar += "([^0-9])";
    expr = expr.replace(/\$/g, "$$$$");
    return str.replace(new RegExp(dataVar, "g"), expr + "$1");
  }
  function schemaHasRules(schema, rules) {
    if (typeof schema == "boolean")
      return !schema;
    for (var key in schema)
      if (rules[key])
        return true;
  }
  function schemaHasRulesExcept(schema, rules, exceptKeyword) {
    if (typeof schema == "boolean")
      return !schema && exceptKeyword != "not";
    for (var key in schema)
      if (key != exceptKeyword && rules[key])
        return true;
  }
  function schemaUnknownRules(schema, rules) {
    if (typeof schema == "boolean")
      return;
    for (var key in schema)
      if (!rules[key])
        return key;
  }
  function toQuotedString(str) {
    return "'" + escapeQuotes(str) + "'";
  }
  function getPathExpr(currentPath, expr, jsonPointers, isNumber) {
    var path = jsonPointers ? "'/' + " + expr + (isNumber ? "" : ".replace(/~/g, '~0').replace(/\\//g, '~1')") : isNumber ? "'[' + " + expr + " + ']'" : "'[\\'' + " + expr + " + '\\']'";
    return joinPaths(currentPath, path);
  }
  function getPath(currentPath, prop, jsonPointers) {
    var path = jsonPointers ? toQuotedString("/" + escapeJsonPointer(prop)) : toQuotedString(getProperty(prop));
    return joinPaths(currentPath, path);
  }
  var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
  var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
  function getData($data, lvl, paths) {
    var up, jsonPointer, data, matches;
    if ($data === "")
      return "rootData";
    if ($data[0] == "/") {
      if (!JSON_POINTER.test($data))
        throw new Error("Invalid JSON-pointer: " + $data);
      jsonPointer = $data;
      data = "rootData";
    } else {
      matches = $data.match(RELATIVE_JSON_POINTER);
      if (!matches)
        throw new Error("Invalid JSON-pointer: " + $data);
      up = +matches[1];
      jsonPointer = matches[2];
      if (jsonPointer == "#") {
        if (up >= lvl)
          throw new Error("Cannot access property/index " + up + " levels up, current level is " + lvl);
        return paths[lvl - up];
      }
      if (up > lvl)
        throw new Error("Cannot access data " + up + " levels up, current level is " + lvl);
      data = "data" + (lvl - up || "");
      if (!jsonPointer)
        return data;
    }
    var expr = data;
    var segments = jsonPointer.split("/");
    for (var i = 0;i < segments.length; i++) {
      var segment = segments[i];
      if (segment) {
        data += getProperty(unescapeJsonPointer(segment));
        expr += " && " + data;
      }
    }
    return expr;
  }
  function joinPaths(a, b) {
    if (a == '""')
      return b;
    return (a + " + " + b).replace(/([^\\])' \+ '/g, "$1");
  }
  function unescapeFragment(str) {
    return unescapeJsonPointer(decodeURIComponent(str));
  }
  function escapeFragment(str) {
    return encodeURIComponent(escapeJsonPointer(str));
  }
  function escapeJsonPointer(str) {
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  function unescapeJsonPointer(str) {
    return str.replace(/~1/g, "/").replace(/~0/g, "~");
  }
});

// node_modules/ajv/lib/compile/schema_obj.js
var require_schema_obj = __commonJS((exports, module) => {
  var util2 = require_util();
  module.exports = SchemaObject;
  function SchemaObject(obj) {
    util2.copy(obj, this);
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS((exports, module) => {
  var traverse = module.exports = function(schema, opts, cb) {
    if (typeof opts == "function") {
      cb = opts;
      opts = {};
    }
    cb = opts.cb || cb;
    var pre = typeof cb == "function" ? cb : cb.pre || function() {};
    var post = cb.post || function() {};
    _traverse(opts, pre, post, schema, "", schema);
  };
  traverse.keywords = {
    additionalItems: true,
    items: true,
    contains: true,
    additionalProperties: true,
    propertyNames: true,
    not: true
  };
  traverse.arrayKeywords = {
    items: true,
    allOf: true,
    anyOf: true,
    oneOf: true
  };
  traverse.propsKeywords = {
    definitions: true,
    properties: true,
    patternProperties: true,
    dependencies: true
  };
  traverse.skipKeywords = {
    default: true,
    enum: true,
    const: true,
    required: true,
    maximum: true,
    minimum: true,
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    multipleOf: true,
    maxLength: true,
    minLength: true,
    pattern: true,
    format: true,
    maxItems: true,
    minItems: true,
    uniqueItems: true,
    maxProperties: true,
    minProperties: true
  };
  function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
    if (schema && typeof schema == "object" && !Array.isArray(schema)) {
      pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      for (var key in schema) {
        var sch = schema[key];
        if (Array.isArray(sch)) {
          if (key in traverse.arrayKeywords) {
            for (var i = 0;i < sch.length; i++)
              _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
          }
        } else if (key in traverse.propsKeywords) {
          if (sch && typeof sch == "object") {
            for (var prop in sch)
              _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
          }
        } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
          _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
        }
      }
      post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
    }
  }
  function escapeJsonPtr(str) {
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  }
});

// node_modules/ajv/lib/compile/resolve.js
var require_resolve = __commonJS((exports, module) => {
  var URI = require_uri_all();
  var equal = require_fast_deep_equal();
  var util2 = require_util();
  var SchemaObject = require_schema_obj();
  var traverse = require_json_schema_traverse();
  module.exports = resolve;
  resolve.normalizeId = normalizeId;
  resolve.fullPath = getFullPath;
  resolve.url = resolveUrl;
  resolve.ids = resolveIds;
  resolve.inlineRef = inlineRef;
  resolve.schema = resolveSchema;
  function resolve(compile, root, ref) {
    var refVal = this._refs[ref];
    if (typeof refVal == "string") {
      if (this._refs[refVal])
        refVal = this._refs[refVal];
      else
        return resolve.call(this, compile, root, refVal);
    }
    refVal = refVal || this._schemas[ref];
    if (refVal instanceof SchemaObject) {
      return inlineRef(refVal.schema, this._opts.inlineRefs) ? refVal.schema : refVal.validate || this._compile(refVal);
    }
    var res = resolveSchema.call(this, root, ref);
    var schema, v, baseId;
    if (res) {
      schema = res.schema;
      root = res.root;
      baseId = res.baseId;
    }
    if (schema instanceof SchemaObject) {
      v = schema.validate || compile.call(this, schema.schema, root, undefined, baseId);
    } else if (schema !== undefined) {
      v = inlineRef(schema, this._opts.inlineRefs) ? schema : compile.call(this, schema, root, undefined, baseId);
    }
    return v;
  }
  function resolveSchema(root, ref) {
    var p = URI.parse(ref), refPath = _getFullPath(p), baseId = getFullPath(this._getId(root.schema));
    if (Object.keys(root.schema).length === 0 || refPath !== baseId) {
      var id = normalizeId(refPath);
      var refVal = this._refs[id];
      if (typeof refVal == "string") {
        return resolveRecursive.call(this, root, refVal, p);
      } else if (refVal instanceof SchemaObject) {
        if (!refVal.validate)
          this._compile(refVal);
        root = refVal;
      } else {
        refVal = this._schemas[id];
        if (refVal instanceof SchemaObject) {
          if (!refVal.validate)
            this._compile(refVal);
          if (id == normalizeId(ref))
            return { schema: refVal, root, baseId };
          root = refVal;
        } else {
          return;
        }
      }
      if (!root.schema)
        return;
      baseId = getFullPath(this._getId(root.schema));
    }
    return getJsonPointer.call(this, p, baseId, root.schema, root);
  }
  function resolveRecursive(root, ref, parsedRef) {
    var res = resolveSchema.call(this, root, ref);
    if (res) {
      var schema = res.schema;
      var baseId = res.baseId;
      root = res.root;
      var id = this._getId(schema);
      if (id)
        baseId = resolveUrl(baseId, id);
      return getJsonPointer.call(this, parsedRef, baseId, schema, root);
    }
  }
  var PREVENT_SCOPE_CHANGE = util2.toHash(["properties", "patternProperties", "enum", "dependencies", "definitions"]);
  function getJsonPointer(parsedRef, baseId, schema, root) {
    parsedRef.fragment = parsedRef.fragment || "";
    if (parsedRef.fragment.slice(0, 1) != "/")
      return;
    var parts = parsedRef.fragment.split("/");
    for (var i = 1;i < parts.length; i++) {
      var part = parts[i];
      if (part) {
        part = util2.unescapeFragment(part);
        schema = schema[part];
        if (schema === undefined)
          break;
        var id;
        if (!PREVENT_SCOPE_CHANGE[part]) {
          id = this._getId(schema);
          if (id)
            baseId = resolveUrl(baseId, id);
          if (schema.$ref) {
            var $ref = resolveUrl(baseId, schema.$ref);
            var res = resolveSchema.call(this, root, $ref);
            if (res) {
              schema = res.schema;
              root = res.root;
              baseId = res.baseId;
            }
          }
        }
      }
    }
    if (schema !== undefined && schema !== root.schema)
      return { schema, root, baseId };
  }
  var SIMPLE_INLINED = util2.toHash([
    "type",
    "format",
    "pattern",
    "maxLength",
    "minLength",
    "maxProperties",
    "minProperties",
    "maxItems",
    "minItems",
    "maximum",
    "minimum",
    "uniqueItems",
    "multipleOf",
    "required",
    "enum"
  ]);
  function inlineRef(schema, limit) {
    if (limit === false)
      return false;
    if (limit === undefined || limit === true)
      return checkNoRef(schema);
    else if (limit)
      return countKeys(schema) <= limit;
  }
  function checkNoRef(schema) {
    var item;
    if (Array.isArray(schema)) {
      for (var i = 0;i < schema.length; i++) {
        item = schema[i];
        if (typeof item == "object" && !checkNoRef(item))
          return false;
      }
    } else {
      for (var key in schema) {
        if (key == "$ref")
          return false;
        item = schema[key];
        if (typeof item == "object" && !checkNoRef(item))
          return false;
      }
    }
    return true;
  }
  function countKeys(schema) {
    var count = 0, item;
    if (Array.isArray(schema)) {
      for (var i = 0;i < schema.length; i++) {
        item = schema[i];
        if (typeof item == "object")
          count += countKeys(item);
        if (count == Infinity)
          return Infinity;
      }
    } else {
      for (var key in schema) {
        if (key == "$ref")
          return Infinity;
        if (SIMPLE_INLINED[key]) {
          count++;
        } else {
          item = schema[key];
          if (typeof item == "object")
            count += countKeys(item) + 1;
          if (count == Infinity)
            return Infinity;
        }
      }
    }
    return count;
  }
  function getFullPath(id, normalize) {
    if (normalize !== false)
      id = normalizeId(id);
    var p = URI.parse(id);
    return _getFullPath(p);
  }
  function _getFullPath(p) {
    return URI.serialize(p).split("#")[0] + "#";
  }
  var TRAILING_SLASH_HASH = /#\/?$/;
  function normalizeId(id) {
    return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
  }
  function resolveUrl(baseId, id) {
    id = normalizeId(id);
    return URI.resolve(baseId, id);
  }
  function resolveIds(schema) {
    var schemaId = normalizeId(this._getId(schema));
    var baseIds = { "": schemaId };
    var fullPaths = { "": getFullPath(schemaId, false) };
    var localRefs = {};
    var self = this;
    traverse(schema, { allKeys: true }, function(sch, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (jsonPtr === "")
        return;
      var id = self._getId(sch);
      var baseId = baseIds[parentJsonPtr];
      var fullPath = fullPaths[parentJsonPtr] + "/" + parentKeyword;
      if (keyIndex !== undefined)
        fullPath += "/" + (typeof keyIndex == "number" ? keyIndex : util2.escapeFragment(keyIndex));
      if (typeof id == "string") {
        id = baseId = normalizeId(baseId ? URI.resolve(baseId, id) : id);
        var refVal = self._refs[id];
        if (typeof refVal == "string")
          refVal = self._refs[refVal];
        if (refVal && refVal.schema) {
          if (!equal(sch, refVal.schema))
            throw new Error('id "' + id + '" resolves to more than one schema');
        } else if (id != normalizeId(fullPath)) {
          if (id[0] == "#") {
            if (localRefs[id] && !equal(sch, localRefs[id]))
              throw new Error('id "' + id + '" resolves to more than one schema');
            localRefs[id] = sch;
          } else {
            self._refs[id] = fullPath;
          }
        }
      }
      baseIds[jsonPtr] = baseId;
      fullPaths[jsonPtr] = fullPath;
    });
    return localRefs;
  }
});

// node_modules/ajv/lib/compile/error_classes.js
var require_error_classes = __commonJS((exports, module) => {
  var resolve = require_resolve();
  module.exports = {
    Validation: errorSubclass(ValidationError),
    MissingRef: errorSubclass(MissingRefError)
  };
  function ValidationError(errors) {
    this.message = "validation failed";
    this.errors = errors;
    this.ajv = this.validation = true;
  }
  MissingRefError.message = function(baseId, ref) {
    return "can't resolve reference " + ref + " from id " + baseId;
  };
  function MissingRefError(baseId, ref, message) {
    this.message = message || MissingRefError.message(baseId, ref);
    this.missingRef = resolve.url(baseId, ref);
    this.missingSchema = resolve.normalizeId(resolve.fullPath(this.missingRef));
  }
  function errorSubclass(Subclass) {
    Subclass.prototype = Object.create(Error.prototype);
    Subclass.prototype.constructor = Subclass;
    return Subclass;
  }
});

// node_modules/fast-json-stable-stringify/index.js
var require_fast_json_stable_stringify = __commonJS((exports, module) => {
  module.exports = function(data, opts) {
    if (!opts)
      opts = {};
    if (typeof opts === "function")
      opts = { cmp: opts };
    var cycles = typeof opts.cycles === "boolean" ? opts.cycles : false;
    var cmp = opts.cmp && function(f) {
      return function(node) {
        return function(a, b) {
          var aobj = { key: a, value: node[a] };
          var bobj = { key: b, value: node[b] };
          return f(aobj, bobj);
        };
      };
    }(opts.cmp);
    var seen = [];
    return function stringify(node) {
      if (node && node.toJSON && typeof node.toJSON === "function") {
        node = node.toJSON();
      }
      if (node === undefined)
        return;
      if (typeof node == "number")
        return isFinite(node) ? "" + node : "null";
      if (typeof node !== "object")
        return JSON.stringify(node);
      var i, out;
      if (Array.isArray(node)) {
        out = "[";
        for (i = 0;i < node.length; i++) {
          if (i)
            out += ",";
          out += stringify(node[i]) || "null";
        }
        return out + "]";
      }
      if (node === null)
        return "null";
      if (seen.indexOf(node) !== -1) {
        if (cycles)
          return JSON.stringify("__cycle__");
        throw new TypeError("Converting circular structure to JSON");
      }
      var seenIndex = seen.push(node) - 1;
      var keys = Object.keys(node).sort(cmp && cmp(node));
      out = "";
      for (i = 0;i < keys.length; i++) {
        var key = keys[i];
        var value = stringify(node[key]);
        if (!value)
          continue;
        if (out)
          out += ",";
        out += JSON.stringify(key) + ":" + value;
      }
      seen.splice(seenIndex, 1);
      return "{" + out + "}";
    }(data);
  };
});

// node_modules/ajv/lib/dotjs/validate.js
var require_validate = __commonJS((exports, module) => {
  module.exports = function generate_validate(it, $keyword, $ruleType) {
    var out = "";
    var $async = it.schema.$async === true, $refKeywords = it.util.schemaHasRulesExcept(it.schema, it.RULES.all, "$ref"), $id = it.self._getId(it.schema);
    if (it.opts.strictKeywords) {
      var $unknownKwd = it.util.schemaUnknownRules(it.schema, it.RULES.keywords);
      if ($unknownKwd) {
        var $keywordsMsg = "unknown keyword: " + $unknownKwd;
        if (it.opts.strictKeywords === "log")
          it.logger.warn($keywordsMsg);
        else
          throw new Error($keywordsMsg);
      }
    }
    if (it.isTop) {
      out += " var validate = ";
      if ($async) {
        it.async = true;
        out += "async ";
      }
      out += "function(data, dataPath, parentData, parentDataProperty, rootData) { 'use strict'; ";
      if ($id && (it.opts.sourceCode || it.opts.processCode)) {
        out += " " + ("/*# sourceURL=" + $id + " */") + " ";
      }
    }
    if (typeof it.schema == "boolean" || !($refKeywords || it.schema.$ref)) {
      var $keyword = "false schema";
      var $lvl = it.level;
      var $dataLvl = it.dataLevel;
      var $schema = it.schema[$keyword];
      var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
      var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
      var $breakOnError = !it.opts.allErrors;
      var $errorKeyword;
      var $data = "data" + ($dataLvl || "");
      var $valid = "valid" + $lvl;
      if (it.schema === false) {
        if (it.isTop) {
          $breakOnError = true;
        } else {
          out += " var " + $valid + " = false; ";
        }
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
          out += " { keyword: '" + ($errorKeyword || "false schema") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
          if (it.opts.messages !== false) {
            out += " , message: 'boolean schema is false' ";
          }
          if (it.opts.verbose) {
            out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
          }
          out += " } ";
        } else {
          out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
          if (it.async) {
            out += " throw new ValidationError([" + __err + "]); ";
          } else {
            out += " validate.errors = [" + __err + "]; return false; ";
          }
        } else {
          out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
      } else {
        if (it.isTop) {
          if ($async) {
            out += " return data; ";
          } else {
            out += " validate.errors = null; return true; ";
          }
        } else {
          out += " var " + $valid + " = true; ";
        }
      }
      if (it.isTop) {
        out += " }; return validate; ";
      }
      return out;
    }
    if (it.isTop) {
      var $top = it.isTop, $lvl = it.level = 0, $dataLvl = it.dataLevel = 0, $data = "data";
      it.rootId = it.resolve.fullPath(it.self._getId(it.root.schema));
      it.baseId = it.baseId || it.rootId;
      delete it.isTop;
      it.dataPathArr = [""];
      if (it.schema.default !== undefined && it.opts.useDefaults && it.opts.strictDefaults) {
        var $defaultMsg = "default is ignored in the schema root";
        if (it.opts.strictDefaults === "log")
          it.logger.warn($defaultMsg);
        else
          throw new Error($defaultMsg);
      }
      out += " var vErrors = null; ";
      out += " var errors = 0;     ";
      out += " if (rootData === undefined) rootData = data; ";
    } else {
      var { level: $lvl, dataLevel: $dataLvl } = it, $data = "data" + ($dataLvl || "");
      if ($id)
        it.baseId = it.resolve.url(it.baseId, $id);
      if ($async && !it.async)
        throw new Error("async schema in sync schema");
      out += " var errs_" + $lvl + " = errors;";
    }
    var $valid = "valid" + $lvl, $breakOnError = !it.opts.allErrors, $closingBraces1 = "", $closingBraces2 = "";
    var $errorKeyword;
    var $typeSchema = it.schema.type, $typeIsArray = Array.isArray($typeSchema);
    if ($typeSchema && it.opts.nullable && it.schema.nullable === true) {
      if ($typeIsArray) {
        if ($typeSchema.indexOf("null") == -1)
          $typeSchema = $typeSchema.concat("null");
      } else if ($typeSchema != "null") {
        $typeSchema = [$typeSchema, "null"];
        $typeIsArray = true;
      }
    }
    if ($typeIsArray && $typeSchema.length == 1) {
      $typeSchema = $typeSchema[0];
      $typeIsArray = false;
    }
    if (it.schema.$ref && $refKeywords) {
      if (it.opts.extendRefs == "fail") {
        throw new Error('$ref: validation keywords used in schema at path "' + it.errSchemaPath + '" (see option extendRefs)');
      } else if (it.opts.extendRefs !== true) {
        $refKeywords = false;
        it.logger.warn('$ref: keywords ignored in schema at path "' + it.errSchemaPath + '"');
      }
    }
    if (it.schema.$comment && it.opts.$comment) {
      out += " " + it.RULES.all.$comment.code(it, "$comment");
    }
    if ($typeSchema) {
      if (it.opts.coerceTypes) {
        var $coerceToTypes = it.util.coerceToTypes(it.opts.coerceTypes, $typeSchema);
      }
      var $rulesGroup = it.RULES.types[$typeSchema];
      if ($coerceToTypes || $typeIsArray || $rulesGroup === true || $rulesGroup && !$shouldUseGroup($rulesGroup)) {
        var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type";
        var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type", $method = $typeIsArray ? "checkDataTypes" : "checkDataType";
        out += " if (" + it.util[$method]($typeSchema, $data, it.opts.strictNumbers, true) + ") { ";
        if ($coerceToTypes) {
          var $dataType = "dataType" + $lvl, $coerced = "coerced" + $lvl;
          out += " var " + $dataType + " = typeof " + $data + "; var " + $coerced + " = undefined; ";
          if (it.opts.coerceTypes == "array") {
            out += " if (" + $dataType + " == 'object' && Array.isArray(" + $data + ") && " + $data + ".length == 1) { " + $data + " = " + $data + "[0]; " + $dataType + " = typeof " + $data + "; if (" + it.util.checkDataType(it.schema.type, $data, it.opts.strictNumbers) + ") " + $coerced + " = " + $data + "; } ";
          }
          out += " if (" + $coerced + " !== undefined) ; ";
          var arr1 = $coerceToTypes;
          if (arr1) {
            var $type, $i = -1, l1 = arr1.length - 1;
            while ($i < l1) {
              $type = arr1[$i += 1];
              if ($type == "string") {
                out += " else if (" + $dataType + " == 'number' || " + $dataType + " == 'boolean') " + $coerced + " = '' + " + $data + "; else if (" + $data + " === null) " + $coerced + " = ''; ";
              } else if ($type == "number" || $type == "integer") {
                out += " else if (" + $dataType + " == 'boolean' || " + $data + " === null || (" + $dataType + " == 'string' && " + $data + " && " + $data + " == +" + $data + " ";
                if ($type == "integer") {
                  out += " && !(" + $data + " % 1)";
                }
                out += ")) " + $coerced + " = +" + $data + "; ";
              } else if ($type == "boolean") {
                out += " else if (" + $data + " === 'false' || " + $data + " === 0 || " + $data + " === null) " + $coerced + " = false; else if (" + $data + " === 'true' || " + $data + " === 1) " + $coerced + " = true; ";
              } else if ($type == "null") {
                out += " else if (" + $data + " === '' || " + $data + " === 0 || " + $data + " === false) " + $coerced + " = null; ";
              } else if (it.opts.coerceTypes == "array" && $type == "array") {
                out += " else if (" + $dataType + " == 'string' || " + $dataType + " == 'number' || " + $dataType + " == 'boolean' || " + $data + " == null) " + $coerced + " = [" + $data + "]; ";
              }
            }
          }
          out += " else {   ";
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
            if ($typeIsArray) {
              out += "" + $typeSchema.join(",");
            } else {
              out += "" + $typeSchema;
            }
            out += "' } ";
            if (it.opts.messages !== false) {
              out += " , message: 'should be ";
              if ($typeIsArray) {
                out += "" + $typeSchema.join(",");
              } else {
                out += "" + $typeSchema;
              }
              out += "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
          out += " } if (" + $coerced + " !== undefined) {  ";
          var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
          out += " " + $data + " = " + $coerced + "; ";
          if (!$dataLvl) {
            out += "if (" + $parentData + " !== undefined)";
          }
          out += " " + $parentData + "[" + $parentDataProperty + "] = " + $coerced + "; } ";
        } else {
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
            if ($typeIsArray) {
              out += "" + $typeSchema.join(",");
            } else {
              out += "" + $typeSchema;
            }
            out += "' } ";
            if (it.opts.messages !== false) {
              out += " , message: 'should be ";
              if ($typeIsArray) {
                out += "" + $typeSchema.join(",");
              } else {
                out += "" + $typeSchema;
              }
              out += "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
        }
        out += " } ";
      }
    }
    if (it.schema.$ref && !$refKeywords) {
      out += " " + it.RULES.all.$ref.code(it, "$ref") + " ";
      if ($breakOnError) {
        out += " } if (errors === ";
        if ($top) {
          out += "0";
        } else {
          out += "errs_" + $lvl;
        }
        out += ") { ";
        $closingBraces2 += "}";
      }
    } else {
      var arr2 = it.RULES;
      if (arr2) {
        var $rulesGroup, i2 = -1, l2 = arr2.length - 1;
        while (i2 < l2) {
          $rulesGroup = arr2[i2 += 1];
          if ($shouldUseGroup($rulesGroup)) {
            if ($rulesGroup.type) {
              out += " if (" + it.util.checkDataType($rulesGroup.type, $data, it.opts.strictNumbers) + ") { ";
            }
            if (it.opts.useDefaults) {
              if ($rulesGroup.type == "object" && it.schema.properties) {
                var $schema = it.schema.properties, $schemaKeys = Object.keys($schema);
                var arr3 = $schemaKeys;
                if (arr3) {
                  var $propertyKey, i3 = -1, l3 = arr3.length - 1;
                  while (i3 < l3) {
                    $propertyKey = arr3[i3 += 1];
                    var $sch = $schema[$propertyKey];
                    if ($sch.default !== undefined) {
                      var $passData = $data + it.util.getProperty($propertyKey);
                      if (it.compositeRule) {
                        if (it.opts.strictDefaults) {
                          var $defaultMsg = "default is ignored for: " + $passData;
                          if (it.opts.strictDefaults === "log")
                            it.logger.warn($defaultMsg);
                          else
                            throw new Error($defaultMsg);
                        }
                      } else {
                        out += " if (" + $passData + " === undefined ";
                        if (it.opts.useDefaults == "empty") {
                          out += " || " + $passData + " === null || " + $passData + " === '' ";
                        }
                        out += " ) " + $passData + " = ";
                        if (it.opts.useDefaults == "shared") {
                          out += " " + it.useDefault($sch.default) + " ";
                        } else {
                          out += " " + JSON.stringify($sch.default) + " ";
                        }
                        out += "; ";
                      }
                    }
                  }
                }
              } else if ($rulesGroup.type == "array" && Array.isArray(it.schema.items)) {
                var arr4 = it.schema.items;
                if (arr4) {
                  var $sch, $i = -1, l4 = arr4.length - 1;
                  while ($i < l4) {
                    $sch = arr4[$i += 1];
                    if ($sch.default !== undefined) {
                      var $passData = $data + "[" + $i + "]";
                      if (it.compositeRule) {
                        if (it.opts.strictDefaults) {
                          var $defaultMsg = "default is ignored for: " + $passData;
                          if (it.opts.strictDefaults === "log")
                            it.logger.warn($defaultMsg);
                          else
                            throw new Error($defaultMsg);
                        }
                      } else {
                        out += " if (" + $passData + " === undefined ";
                        if (it.opts.useDefaults == "empty") {
                          out += " || " + $passData + " === null || " + $passData + " === '' ";
                        }
                        out += " ) " + $passData + " = ";
                        if (it.opts.useDefaults == "shared") {
                          out += " " + it.useDefault($sch.default) + " ";
                        } else {
                          out += " " + JSON.stringify($sch.default) + " ";
                        }
                        out += "; ";
                      }
                    }
                  }
                }
              }
            }
            var arr5 = $rulesGroup.rules;
            if (arr5) {
              var $rule, i5 = -1, l5 = arr5.length - 1;
              while (i5 < l5) {
                $rule = arr5[i5 += 1];
                if ($shouldUseRule($rule)) {
                  var $code = $rule.code(it, $rule.keyword, $rulesGroup.type);
                  if ($code) {
                    out += " " + $code + " ";
                    if ($breakOnError) {
                      $closingBraces1 += "}";
                    }
                  }
                }
              }
            }
            if ($breakOnError) {
              out += " " + $closingBraces1 + " ";
              $closingBraces1 = "";
            }
            if ($rulesGroup.type) {
              out += " } ";
              if ($typeSchema && $typeSchema === $rulesGroup.type && !$coerceToTypes) {
                out += " else { ";
                var $schemaPath = it.schemaPath + ".type", $errSchemaPath = it.errSchemaPath + "/type";
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = "";
                if (it.createErrors !== false) {
                  out += " { keyword: '" + ($errorKeyword || "type") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { type: '";
                  if ($typeIsArray) {
                    out += "" + $typeSchema.join(",");
                  } else {
                    out += "" + $typeSchema;
                  }
                  out += "' } ";
                  if (it.opts.messages !== false) {
                    out += " , message: 'should be ";
                    if ($typeIsArray) {
                      out += "" + $typeSchema.join(",");
                    } else {
                      out += "" + $typeSchema;
                    }
                    out += "' ";
                  }
                  if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                  }
                  out += " } ";
                } else {
                  out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                  if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                  } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                  }
                } else {
                  out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
                out += " } ";
              }
            }
            if ($breakOnError) {
              out += " if (errors === ";
              if ($top) {
                out += "0";
              } else {
                out += "errs_" + $lvl;
              }
              out += ") { ";
              $closingBraces2 += "}";
            }
          }
        }
      }
    }
    if ($breakOnError) {
      out += " " + $closingBraces2 + " ";
    }
    if ($top) {
      if ($async) {
        out += " if (errors === 0) return data;           ";
        out += " else throw new ValidationError(vErrors); ";
      } else {
        out += " validate.errors = vErrors; ";
        out += " return errors === 0;       ";
      }
      out += " }; return validate;";
    } else {
      out += " var " + $valid + " = errors === errs_" + $lvl + ";";
    }
    function $shouldUseGroup($rulesGroup2) {
      var rules = $rulesGroup2.rules;
      for (var i = 0;i < rules.length; i++)
        if ($shouldUseRule(rules[i]))
          return true;
    }
    function $shouldUseRule($rule2) {
      return it.schema[$rule2.keyword] !== undefined || $rule2.implements && $ruleImplementsSomeKeyword($rule2);
    }
    function $ruleImplementsSomeKeyword($rule2) {
      var impl = $rule2.implements;
      for (var i = 0;i < impl.length; i++)
        if (it.schema[impl[i]] !== undefined)
          return true;
    }
    return out;
  };
});

// node_modules/ajv/lib/compile/index.js
var require_compile = __commonJS((exports, module) => {
  var resolve = require_resolve();
  var util2 = require_util();
  var errorClasses = require_error_classes();
  var stableStringify = require_fast_json_stable_stringify();
  var validateGenerator = require_validate();
  var ucs2length = util2.ucs2length;
  var equal = require_fast_deep_equal();
  var ValidationError = errorClasses.Validation;
  module.exports = compile;
  function compile(schema, root, localRefs, baseId) {
    var self = this, opts = this._opts, refVal = [undefined], refs = {}, patterns = [], patternsHash = {}, defaults = [], defaultsHash = {}, customRules = [];
    root = root || { schema, refVal, refs };
    var c = checkCompiling.call(this, schema, root, baseId);
    var compilation = this._compilations[c.index];
    if (c.compiling)
      return compilation.callValidate = callValidate;
    var formats = this._formats;
    var RULES = this.RULES;
    try {
      var v = localCompile(schema, root, localRefs, baseId);
      compilation.validate = v;
      var cv = compilation.callValidate;
      if (cv) {
        cv.schema = v.schema;
        cv.errors = null;
        cv.refs = v.refs;
        cv.refVal = v.refVal;
        cv.root = v.root;
        cv.$async = v.$async;
        if (opts.sourceCode)
          cv.source = v.source;
      }
      return v;
    } finally {
      endCompiling.call(this, schema, root, baseId);
    }
    function callValidate() {
      var validate = compilation.validate;
      var result = validate.apply(this, arguments);
      callValidate.errors = validate.errors;
      return result;
    }
    function localCompile(_schema, _root, localRefs2, baseId2) {
      var isRoot = !_root || _root && _root.schema == _schema;
      if (_root.schema != root.schema)
        return compile.call(self, _schema, _root, localRefs2, baseId2);
      var $async = _schema.$async === true;
      var sourceCode = validateGenerator({
        isTop: true,
        schema: _schema,
        isRoot,
        baseId: baseId2,
        root: _root,
        schemaPath: "",
        errSchemaPath: "#",
        errorPath: '""',
        MissingRefError: errorClasses.MissingRef,
        RULES,
        validate: validateGenerator,
        util: util2,
        resolve,
        resolveRef,
        usePattern,
        useDefault,
        useCustomRule,
        opts,
        formats,
        logger: self.logger,
        self
      });
      sourceCode = vars(refVal, refValCode) + vars(patterns, patternCode) + vars(defaults, defaultCode) + vars(customRules, customRuleCode) + sourceCode;
      if (opts.processCode)
        sourceCode = opts.processCode(sourceCode, _schema);
      var validate;
      try {
        var makeValidate = new Function("self", "RULES", "formats", "root", "refVal", "defaults", "customRules", "equal", "ucs2length", "ValidationError", sourceCode);
        validate = makeValidate(self, RULES, formats, root, refVal, defaults, customRules, equal, ucs2length, ValidationError);
        refVal[0] = validate;
      } catch (e) {
        self.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      }
      validate.schema = _schema;
      validate.errors = null;
      validate.refs = refs;
      validate.refVal = refVal;
      validate.root = isRoot ? validate : _root;
      if ($async)
        validate.$async = true;
      if (opts.sourceCode === true) {
        validate.source = {
          code: sourceCode,
          patterns,
          defaults
        };
      }
      return validate;
    }
    function resolveRef(baseId2, ref, isRoot) {
      ref = resolve.url(baseId2, ref);
      var refIndex = refs[ref];
      var _refVal, refCode;
      if (refIndex !== undefined) {
        _refVal = refVal[refIndex];
        refCode = "refVal[" + refIndex + "]";
        return resolvedRef(_refVal, refCode);
      }
      if (!isRoot && root.refs) {
        var rootRefId = root.refs[ref];
        if (rootRefId !== undefined) {
          _refVal = root.refVal[rootRefId];
          refCode = addLocalRef(ref, _refVal);
          return resolvedRef(_refVal, refCode);
        }
      }
      refCode = addLocalRef(ref);
      var v2 = resolve.call(self, localCompile, root, ref);
      if (v2 === undefined) {
        var localSchema = localRefs && localRefs[ref];
        if (localSchema) {
          v2 = resolve.inlineRef(localSchema, opts.inlineRefs) ? localSchema : compile.call(self, localSchema, root, localRefs, baseId2);
        }
      }
      if (v2 === undefined) {
        removeLocalRef(ref);
      } else {
        replaceLocalRef(ref, v2);
        return resolvedRef(v2, refCode);
      }
    }
    function addLocalRef(ref, v2) {
      var refId = refVal.length;
      refVal[refId] = v2;
      refs[ref] = refId;
      return "refVal" + refId;
    }
    function removeLocalRef(ref) {
      delete refs[ref];
    }
    function replaceLocalRef(ref, v2) {
      var refId = refs[ref];
      refVal[refId] = v2;
    }
    function resolvedRef(refVal2, code) {
      return typeof refVal2 == "object" || typeof refVal2 == "boolean" ? { code, schema: refVal2, inline: true } : { code, $async: refVal2 && !!refVal2.$async };
    }
    function usePattern(regexStr) {
      var index = patternsHash[regexStr];
      if (index === undefined) {
        index = patternsHash[regexStr] = patterns.length;
        patterns[index] = regexStr;
      }
      return "pattern" + index;
    }
    function useDefault(value) {
      switch (typeof value) {
        case "boolean":
        case "number":
          return "" + value;
        case "string":
          return util2.toQuotedString(value);
        case "object":
          if (value === null)
            return "null";
          var valueStr = stableStringify(value);
          var index = defaultsHash[valueStr];
          if (index === undefined) {
            index = defaultsHash[valueStr] = defaults.length;
            defaults[index] = value;
          }
          return "default" + index;
      }
    }
    function useCustomRule(rule, schema2, parentSchema, it) {
      if (self._opts.validateSchema !== false) {
        var deps = rule.definition.dependencies;
        if (deps && !deps.every(function(keyword) {
          return Object.prototype.hasOwnProperty.call(parentSchema, keyword);
        }))
          throw new Error("parent schema must have all required keywords: " + deps.join(","));
        var validateSchema = rule.definition.validateSchema;
        if (validateSchema) {
          var valid = validateSchema(schema2);
          if (!valid) {
            var message = "keyword schema is invalid: " + self.errorsText(validateSchema.errors);
            if (self._opts.validateSchema == "log")
              self.logger.error(message);
            else
              throw new Error(message);
          }
        }
      }
      var compile2 = rule.definition.compile, inline = rule.definition.inline, macro = rule.definition.macro;
      var validate;
      if (compile2) {
        validate = compile2.call(self, schema2, parentSchema, it);
      } else if (macro) {
        validate = macro.call(self, schema2, parentSchema, it);
        if (opts.validateSchema !== false)
          self.validateSchema(validate, true);
      } else if (inline) {
        validate = inline.call(self, it, rule.keyword, schema2, parentSchema);
      } else {
        validate = rule.definition.validate;
        if (!validate)
          return;
      }
      if (validate === undefined)
        throw new Error('custom keyword "' + rule.keyword + '"failed to compile');
      var index = customRules.length;
      customRules[index] = validate;
      return {
        code: "customRule" + index,
        validate
      };
    }
  }
  function checkCompiling(schema, root, baseId) {
    var index = compIndex.call(this, schema, root, baseId);
    if (index >= 0)
      return { index, compiling: true };
    index = this._compilations.length;
    this._compilations[index] = {
      schema,
      root,
      baseId
    };
    return { index, compiling: false };
  }
  function endCompiling(schema, root, baseId) {
    var i = compIndex.call(this, schema, root, baseId);
    if (i >= 0)
      this._compilations.splice(i, 1);
  }
  function compIndex(schema, root, baseId) {
    for (var i = 0;i < this._compilations.length; i++) {
      var c = this._compilations[i];
      if (c.schema == schema && c.root == root && c.baseId == baseId)
        return i;
    }
    return -1;
  }
  function patternCode(i, patterns) {
    return "var pattern" + i + " = new RegExp(" + util2.toQuotedString(patterns[i]) + ");";
  }
  function defaultCode(i) {
    return "var default" + i + " = defaults[" + i + "];";
  }
  function refValCode(i, refVal) {
    return refVal[i] === undefined ? "" : "var refVal" + i + " = refVal[" + i + "];";
  }
  function customRuleCode(i) {
    return "var customRule" + i + " = customRules[" + i + "];";
  }
  function vars(arr, statement) {
    if (!arr.length)
      return "";
    var code = "";
    for (var i = 0;i < arr.length; i++)
      code += statement(i, arr);
    return code;
  }
});

// node_modules/ajv/lib/cache.js
var require_cache = __commonJS((exports, module) => {
  var Cache = module.exports = function Cache() {
    this._cache = {};
  };
  Cache.prototype.put = function Cache_put(key, value) {
    this._cache[key] = value;
  };
  Cache.prototype.get = function Cache_get(key) {
    return this._cache[key];
  };
  Cache.prototype.del = function Cache_del(key) {
    delete this._cache[key];
  };
  Cache.prototype.clear = function Cache_clear() {
    this._cache = {};
  };
});

// node_modules/ajv/lib/compile/formats.js
var require_formats = __commonJS((exports, module) => {
  var util2 = require_util();
  var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
  var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var TIME = /^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d(?::?\d\d)?)?$/i;
  var HOSTNAME = /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i;
  var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
  var URIREF = /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
  var URITEMPLATE = /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i;
  var URL2 = /^(?:(?:http[s\u017F]?|ftp):\/\/)(?:(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+(?::(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?@)?(?:(?!10(?:\.[0-9]{1,3}){3})(?!127(?:\.[0-9]{1,3}){3})(?!169\.254(?:\.[0-9]{1,3}){2})(?!192\.168(?:\.[0-9]{1,3}){2})(?!172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2})(?:[1-9][0-9]?|1[0-9][0-9]|2[01][0-9]|22[0-3])(?:\.(?:1?[0-9]{1,2}|2[0-4][0-9]|25[0-5])){2}(?:\.(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-4]))|(?:(?:(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-)*(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)(?:\.(?:(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+-)*(?:[0-9a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+)*(?:\.(?:(?:[a-z\xA1-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]){2,})))(?::[0-9]{2,5})?(?:\/(?:[\0-\x08\x0E-\x1F!-\x9F\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\uD7FF\uE000-\uFEFE\uFF00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])*)?$/i;
  var UUID = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  var JSON_POINTER = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
  var JSON_POINTER_URI_FRAGMENT = /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
  var RELATIVE_JSON_POINTER = /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/;
  module.exports = formats;
  function formats(mode) {
    mode = mode == "full" ? "full" : "fast";
    return util2.copy(formats[mode]);
  }
  formats.fast = {
    date: /^\d\d\d\d-[0-1]\d-[0-3]\d$/,
    time: /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i,
    "date-time": /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
    uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
    "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
    "uri-template": URITEMPLATE,
    url: URL2,
    email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
    hostname: HOSTNAME,
    ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    ipv6: /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
    regex,
    uuid: UUID,
    "json-pointer": JSON_POINTER,
    "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
    "relative-json-pointer": RELATIVE_JSON_POINTER
  };
  formats.full = {
    date,
    time,
    "date-time": date_time,
    uri,
    "uri-reference": URIREF,
    "uri-template": URITEMPLATE,
    url: URL2,
    email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
    hostname: HOSTNAME,
    ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    ipv6: /^\s*(?:(?:(?:[0-9a-f]{1,4}:){7}(?:[0-9a-f]{1,4}|:))|(?:(?:[0-9a-f]{1,4}:){6}(?::[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){5}(?:(?:(?::[0-9a-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(?:(?:[0-9a-f]{1,4}:){4}(?:(?:(?::[0-9a-f]{1,4}){1,3})|(?:(?::[0-9a-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){3}(?:(?:(?::[0-9a-f]{1,4}){1,4})|(?:(?::[0-9a-f]{1,4}){0,2}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){2}(?:(?:(?::[0-9a-f]{1,4}){1,5})|(?:(?::[0-9a-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?:(?:[0-9a-f]{1,4}:){1}(?:(?:(?::[0-9a-f]{1,4}){1,6})|(?:(?::[0-9a-f]{1,4}){0,4}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(?::(?:(?:(?::[0-9a-f]{1,4}){1,7})|(?:(?::[0-9a-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(?:%.+)?\s*$/i,
    regex,
    uuid: UUID,
    "json-pointer": JSON_POINTER,
    "json-pointer-uri-fragment": JSON_POINTER_URI_FRAGMENT,
    "relative-json-pointer": RELATIVE_JSON_POINTER
  };
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  function date(str) {
    var matches = str.match(DATE);
    if (!matches)
      return false;
    var year = +matches[1];
    var month = +matches[2];
    var day = +matches[3];
    return month >= 1 && month <= 12 && day >= 1 && day <= (month == 2 && isLeapYear(year) ? 29 : DAYS[month]);
  }
  function time(str, full) {
    var matches = str.match(TIME);
    if (!matches)
      return false;
    var hour = matches[1];
    var minute = matches[2];
    var second = matches[3];
    var timeZone = matches[5];
    return (hour <= 23 && minute <= 59 && second <= 59 || hour == 23 && minute == 59 && second == 60) && (!full || timeZone);
  }
  var DATE_TIME_SEPARATOR = /t|\s/i;
  function date_time(str) {
    var dateTime = str.split(DATE_TIME_SEPARATOR);
    return dateTime.length == 2 && date(dateTime[0]) && time(dateTime[1], true);
  }
  var NOT_URI_FRAGMENT = /\/|:/;
  function uri(str) {
    return NOT_URI_FRAGMENT.test(str) && URI.test(str);
  }
  var Z_ANCHOR = /[^\\]\\Z/;
  function regex(str) {
    if (Z_ANCHOR.test(str))
      return false;
    try {
      new RegExp(str);
      return true;
    } catch (e) {
      return false;
    }
  }
});

// node_modules/ajv/lib/dotjs/ref.js
var require_ref = __commonJS((exports, module) => {
  module.exports = function generate_ref(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $async, $refCode;
    if ($schema == "#" || $schema == "#/") {
      if (it.isRoot) {
        $async = it.async;
        $refCode = "validate";
      } else {
        $async = it.root.schema.$async === true;
        $refCode = "root.refVal[0]";
      }
    } else {
      var $refVal = it.resolveRef(it.baseId, $schema, it.isRoot);
      if ($refVal === undefined) {
        var $message = it.MissingRefError.message(it.baseId, $schema);
        if (it.opts.missingRefs == "fail") {
          it.logger.error($message);
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + "$ref" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { ref: '" + it.util.escapeQuotes($schema) + "' } ";
            if (it.opts.messages !== false) {
              out += " , message: 'can\\'t resolve reference " + it.util.escapeQuotes($schema) + "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: " + it.util.toQuotedString($schema) + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
          if ($breakOnError) {
            out += " if (false) { ";
          }
        } else if (it.opts.missingRefs == "ignore") {
          it.logger.warn($message);
          if ($breakOnError) {
            out += " if (true) { ";
          }
        } else {
          throw new it.MissingRefError(it.baseId, $schema, $message);
        }
      } else if ($refVal.inline) {
        var $it = it.util.copy(it);
        $it.level++;
        var $nextValid = "valid" + $it.level;
        $it.schema = $refVal.schema;
        $it.schemaPath = "";
        $it.errSchemaPath = $schema;
        var $code = it.validate($it).replace(/validate\.schema/g, $refVal.code);
        out += " " + $code + " ";
        if ($breakOnError) {
          out += " if (" + $nextValid + ") { ";
        }
      } else {
        $async = $refVal.$async === true || it.async && $refVal.$async !== false;
        $refCode = $refVal.code;
      }
    }
    if ($refCode) {
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      if (it.opts.passContext) {
        out += " " + $refCode + ".call(this, ";
      } else {
        out += " " + $refCode + "( ";
      }
      out += " " + $data + ", (dataPath || '')";
      if (it.errorPath != '""') {
        out += " + " + it.errorPath;
      }
      var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
      out += " , " + $parentData + " , " + $parentDataProperty + ", rootData)  ";
      var __callValidate = out;
      out = $$outStack.pop();
      if ($async) {
        if (!it.async)
          throw new Error("async schema referenced by sync schema");
        if ($breakOnError) {
          out += " var " + $valid + "; ";
        }
        out += " try { await " + __callValidate + "; ";
        if ($breakOnError) {
          out += " " + $valid + " = true; ";
        }
        out += " } catch (e) { if (!(e instanceof ValidationError)) throw e; if (vErrors === null) vErrors = e.errors; else vErrors = vErrors.concat(e.errors); errors = vErrors.length; ";
        if ($breakOnError) {
          out += " " + $valid + " = false; ";
        }
        out += " } ";
        if ($breakOnError) {
          out += " if (" + $valid + ") { ";
        }
      } else {
        out += " if (!" + __callValidate + ") { if (vErrors === null) vErrors = " + $refCode + ".errors; else vErrors = vErrors.concat(" + $refCode + ".errors); errors = vErrors.length; } ";
        if ($breakOnError) {
          out += " else { ";
        }
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/allOf.js
var require_allOf = __commonJS((exports, module) => {
  module.exports = function generate_allOf(it, $keyword, $ruleType) {
    var out = " ";
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $currentBaseId = $it.baseId, $allSchemasEmpty = true;
    var arr1 = $schema;
    if (arr1) {
      var $sch, $i = -1, l1 = arr1.length - 1;
      while ($i < l1) {
        $sch = arr1[$i += 1];
        if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
          $allSchemasEmpty = false;
          $it.schema = $sch;
          $it.schemaPath = $schemaPath + "[" + $i + "]";
          $it.errSchemaPath = $errSchemaPath + "/" + $i;
          out += "  " + it.validate($it) + " ";
          $it.baseId = $currentBaseId;
          if ($breakOnError) {
            out += " if (" + $nextValid + ") { ";
            $closingBraces += "}";
          }
        }
      }
    }
    if ($breakOnError) {
      if ($allSchemasEmpty) {
        out += " if (true) { ";
      } else {
        out += " " + $closingBraces.slice(0, -1) + " ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/anyOf.js
var require_anyOf = __commonJS((exports, module) => {
  module.exports = function generate_anyOf(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $noEmptySchema = $schema.every(function($sch2) {
      return it.opts.strictKeywords ? typeof $sch2 == "object" && Object.keys($sch2).length > 0 || $sch2 === false : it.util.schemaHasRules($sch2, it.RULES.all);
    });
    if ($noEmptySchema) {
      var $currentBaseId = $it.baseId;
      out += " var " + $errs + " = errors; var " + $valid + " = false;  ";
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      var arr1 = $schema;
      if (arr1) {
        var $sch, $i = -1, l1 = arr1.length - 1;
        while ($i < l1) {
          $sch = arr1[$i += 1];
          $it.schema = $sch;
          $it.schemaPath = $schemaPath + "[" + $i + "]";
          $it.errSchemaPath = $errSchemaPath + "/" + $i;
          out += "  " + it.validate($it) + " ";
          $it.baseId = $currentBaseId;
          out += " " + $valid + " = " + $valid + " || " + $nextValid + "; if (!" + $valid + ") { ";
          $closingBraces += "}";
        }
      }
      it.compositeRule = $it.compositeRule = $wasComposite;
      out += " " + $closingBraces + " if (!" + $valid + ") {   var err =   ";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "anyOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
        if (it.opts.messages !== false) {
          out += " , message: 'should match some schema in anyOf' ";
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError(vErrors); ";
        } else {
          out += " validate.errors = vErrors; return false; ";
        }
      }
      out += " } else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
      if (it.opts.allErrors) {
        out += " } ";
      }
    } else {
      if ($breakOnError) {
        out += " if (true) { ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/comment.js
var require_comment = __commonJS((exports, module) => {
  module.exports = function generate_comment(it, $keyword, $ruleType) {
    var out = " ";
    var $schema = it.schema[$keyword];
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $comment = it.util.toQuotedString($schema);
    if (it.opts.$comment === true) {
      out += " console.log(" + $comment + ");";
    } else if (typeof it.opts.$comment == "function") {
      out += " self._opts.$comment(" + $comment + ", " + it.util.toQuotedString($errSchemaPath) + ", validate.root.schema);";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/const.js
var require_const = __commonJS((exports, module) => {
  module.exports = function generate_const(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (!$isData) {
      out += " var schema" + $lvl + " = validate.schema" + $schemaPath + ";";
    }
    out += "var " + $valid + " = equal(" + $data + ", schema" + $lvl + "); if (!" + $valid + ") {   ";
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "const" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { allowedValue: schema" + $lvl + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should be equal to constant' ";
      }
      if (it.opts.verbose) {
        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += " }";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/contains.js
var require_contains = __commonJS((exports, module) => {
  module.exports = function generate_contains(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $idx = "i" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $currentBaseId = it.baseId, $nonEmptySchema = it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all);
    out += "var " + $errs + " = errors;var " + $valid + ";";
    if ($nonEmptySchema) {
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      $it.schema = $schema;
      $it.schemaPath = $schemaPath;
      $it.errSchemaPath = $errSchemaPath;
      out += " var " + $nextValid + " = false; for (var " + $idx + " = 0; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
      $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
      var $passData = $data + "[" + $idx + "]";
      $it.dataPathArr[$dataNxt] = $idx;
      var $code = it.validate($it);
      $it.baseId = $currentBaseId;
      if (it.util.varOccurences($code, $nextData) < 2) {
        out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
      } else {
        out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
      }
      out += " if (" + $nextValid + ") break; }  ";
      it.compositeRule = $it.compositeRule = $wasComposite;
      out += " " + $closingBraces + " if (!" + $nextValid + ") {";
    } else {
      out += " if (" + $data + ".length == 0) {";
    }
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "contains" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
      if (it.opts.messages !== false) {
        out += " , message: 'should contain a valid item' ";
      }
      if (it.opts.verbose) {
        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += " } else { ";
    if ($nonEmptySchema) {
      out += "  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
    }
    if (it.opts.allErrors) {
      out += " } ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/dependencies.js
var require_dependencies = __commonJS((exports, module) => {
  module.exports = function generate_dependencies(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $schemaDeps = {}, $propertyDeps = {}, $ownProperties = it.opts.ownProperties;
    for ($property in $schema) {
      if ($property == "__proto__")
        continue;
      var $sch = $schema[$property];
      var $deps = Array.isArray($sch) ? $propertyDeps : $schemaDeps;
      $deps[$property] = $sch;
    }
    out += "var " + $errs + " = errors;";
    var $currentErrorPath = it.errorPath;
    out += "var missing" + $lvl + ";";
    for (var $property in $propertyDeps) {
      $deps = $propertyDeps[$property];
      if ($deps.length) {
        out += " if ( " + $data + it.util.getProperty($property) + " !== undefined ";
        if ($ownProperties) {
          out += " && Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($property) + "') ";
        }
        if ($breakOnError) {
          out += " && ( ";
          var arr1 = $deps;
          if (arr1) {
            var $propertyKey, $i = -1, l1 = arr1.length - 1;
            while ($i < l1) {
              $propertyKey = arr1[$i += 1];
              if ($i) {
                out += " || ";
              }
              var $prop = it.util.getProperty($propertyKey), $useData = $data + $prop;
              out += " ( ( " + $useData + " === undefined ";
              if ($ownProperties) {
                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
              }
              out += ") && (missing" + $lvl + " = " + it.util.toQuotedString(it.opts.jsonPointers ? $propertyKey : $prop) + ") ) ";
            }
          }
          out += ")) {  ";
          var $propertyPath = "missing" + $lvl, $missingProperty = "' + " + $propertyPath + " + '";
          if (it.opts._errorDataPathProperty) {
            it.errorPath = it.opts.jsonPointers ? it.util.getPathExpr($currentErrorPath, $propertyPath, true) : $currentErrorPath + " + " + $propertyPath;
          }
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + "dependencies" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { property: '" + it.util.escapeQuotes($property) + "', missingProperty: '" + $missingProperty + "', depsCount: " + $deps.length + ", deps: '" + it.util.escapeQuotes($deps.length == 1 ? $deps[0] : $deps.join(", ")) + "' } ";
            if (it.opts.messages !== false) {
              out += " , message: 'should have ";
              if ($deps.length == 1) {
                out += "property " + it.util.escapeQuotes($deps[0]);
              } else {
                out += "properties " + it.util.escapeQuotes($deps.join(", "));
              }
              out += " when property " + it.util.escapeQuotes($property) + " is present' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
        } else {
          out += " ) { ";
          var arr2 = $deps;
          if (arr2) {
            var $propertyKey, i2 = -1, l2 = arr2.length - 1;
            while (i2 < l2) {
              $propertyKey = arr2[i2 += 1];
              var $prop = it.util.getProperty($propertyKey), $missingProperty = it.util.escapeQuotes($propertyKey), $useData = $data + $prop;
              if (it.opts._errorDataPathProperty) {
                it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
              }
              out += " if ( " + $useData + " === undefined ";
              if ($ownProperties) {
                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
              }
              out += ") {  var err =   ";
              if (it.createErrors !== false) {
                out += " { keyword: '" + "dependencies" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { property: '" + it.util.escapeQuotes($property) + "', missingProperty: '" + $missingProperty + "', depsCount: " + $deps.length + ", deps: '" + it.util.escapeQuotes($deps.length == 1 ? $deps[0] : $deps.join(", ")) + "' } ";
                if (it.opts.messages !== false) {
                  out += " , message: 'should have ";
                  if ($deps.length == 1) {
                    out += "property " + it.util.escapeQuotes($deps[0]);
                  } else {
                    out += "properties " + it.util.escapeQuotes($deps.join(", "));
                  }
                  out += " when property " + it.util.escapeQuotes($property) + " is present' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
            }
          }
        }
        out += " }   ";
        if ($breakOnError) {
          $closingBraces += "}";
          out += " else { ";
        }
      }
    }
    it.errorPath = $currentErrorPath;
    var $currentBaseId = $it.baseId;
    for (var $property in $schemaDeps) {
      var $sch = $schemaDeps[$property];
      if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
        out += " " + $nextValid + " = true; if ( " + $data + it.util.getProperty($property) + " !== undefined ";
        if ($ownProperties) {
          out += " && Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($property) + "') ";
        }
        out += ") { ";
        $it.schema = $sch;
        $it.schemaPath = $schemaPath + it.util.getProperty($property);
        $it.errSchemaPath = $errSchemaPath + "/" + it.util.escapeFragment($property);
        out += "  " + it.validate($it) + " ";
        $it.baseId = $currentBaseId;
        out += " }  ";
        if ($breakOnError) {
          out += " if (" + $nextValid + ") { ";
          $closingBraces += "}";
        }
      }
    }
    if ($breakOnError) {
      out += "   " + $closingBraces + " if (" + $errs + " == errors) {";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/enum.js
var require_enum = __commonJS((exports, module) => {
  module.exports = function generate_enum(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $i = "i" + $lvl, $vSchema = "schema" + $lvl;
    if (!$isData) {
      out += " var " + $vSchema + " = validate.schema" + $schemaPath + ";";
    }
    out += "var " + $valid + ";";
    if ($isData) {
      out += " if (schema" + $lvl + " === undefined) " + $valid + " = true; else if (!Array.isArray(schema" + $lvl + ")) " + $valid + " = false; else {";
    }
    out += "" + $valid + " = false;for (var " + $i + "=0; " + $i + "<" + $vSchema + ".length; " + $i + "++) if (equal(" + $data + ", " + $vSchema + "[" + $i + "])) { " + $valid + " = true; break; }";
    if ($isData) {
      out += "  }  ";
    }
    out += " if (!" + $valid + ") {   ";
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "enum" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { allowedValues: schema" + $lvl + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should be equal to one of the allowed values' ";
      }
      if (it.opts.verbose) {
        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += " }";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/format.js
var require_format = __commonJS((exports, module) => {
  module.exports = function generate_format(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    if (it.opts.format === false) {
      if ($breakOnError) {
        out += " if (true) { ";
      }
      return out;
    }
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $unknownFormats = it.opts.unknownFormats, $allowUnknown = Array.isArray($unknownFormats);
    if ($isData) {
      var $format = "format" + $lvl, $isObject = "isObject" + $lvl, $formatType = "formatType" + $lvl;
      out += " var " + $format + " = formats[" + $schemaValue + "]; var " + $isObject + " = typeof " + $format + " == 'object' && !(" + $format + " instanceof RegExp) && " + $format + ".validate; var " + $formatType + " = " + $isObject + " && " + $format + ".type || 'string'; if (" + $isObject + ") { ";
      if (it.async) {
        out += " var async" + $lvl + " = " + $format + ".async; ";
      }
      out += " " + $format + " = " + $format + ".validate; } if (  ";
      if ($isData) {
        out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'string') || ";
      }
      out += " (";
      if ($unknownFormats != "ignore") {
        out += " (" + $schemaValue + " && !" + $format + " ";
        if ($allowUnknown) {
          out += " && self._opts.unknownFormats.indexOf(" + $schemaValue + ") == -1 ";
        }
        out += ") || ";
      }
      out += " (" + $format + " && " + $formatType + " == '" + $ruleType + "' && !(typeof " + $format + " == 'function' ? ";
      if (it.async) {
        out += " (async" + $lvl + " ? await " + $format + "(" + $data + ") : " + $format + "(" + $data + ")) ";
      } else {
        out += " " + $format + "(" + $data + ") ";
      }
      out += " : " + $format + ".test(" + $data + "))))) {";
    } else {
      var $format = it.formats[$schema];
      if (!$format) {
        if ($unknownFormats == "ignore") {
          it.logger.warn('unknown format "' + $schema + '" ignored in schema at path "' + it.errSchemaPath + '"');
          if ($breakOnError) {
            out += " if (true) { ";
          }
          return out;
        } else if ($allowUnknown && $unknownFormats.indexOf($schema) >= 0) {
          if ($breakOnError) {
            out += " if (true) { ";
          }
          return out;
        } else {
          throw new Error('unknown format "' + $schema + '" is used in schema at path "' + it.errSchemaPath + '"');
        }
      }
      var $isObject = typeof $format == "object" && !($format instanceof RegExp) && $format.validate;
      var $formatType = $isObject && $format.type || "string";
      if ($isObject) {
        var $async = $format.async === true;
        $format = $format.validate;
      }
      if ($formatType != $ruleType) {
        if ($breakOnError) {
          out += " if (true) { ";
        }
        return out;
      }
      if ($async) {
        if (!it.async)
          throw new Error("async format in sync schema");
        var $formatRef = "formats" + it.util.getProperty($schema) + ".validate";
        out += " if (!(await " + $formatRef + "(" + $data + "))) { ";
      } else {
        out += " if (! ";
        var $formatRef = "formats" + it.util.getProperty($schema);
        if ($isObject)
          $formatRef += ".validate";
        if (typeof $format == "function") {
          out += " " + $formatRef + "(" + $data + ") ";
        } else {
          out += " " + $formatRef + ".test(" + $data + ") ";
        }
        out += ") { ";
      }
    }
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "format" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { format:  ";
      if ($isData) {
        out += "" + $schemaValue;
      } else {
        out += "" + it.util.toQuotedString($schema);
      }
      out += "  } ";
      if (it.opts.messages !== false) {
        out += ` , message: 'should match format "`;
        if ($isData) {
          out += "' + " + $schemaValue + " + '";
        } else {
          out += "" + it.util.escapeQuotes($schema);
        }
        out += `"' `;
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + it.util.toQuotedString($schema);
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += " } ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/if.js
var require_if = __commonJS((exports, module) => {
  module.exports = function generate_if(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $thenSch = it.schema["then"], $elseSch = it.schema["else"], $thenPresent = $thenSch !== undefined && (it.opts.strictKeywords ? typeof $thenSch == "object" && Object.keys($thenSch).length > 0 || $thenSch === false : it.util.schemaHasRules($thenSch, it.RULES.all)), $elsePresent = $elseSch !== undefined && (it.opts.strictKeywords ? typeof $elseSch == "object" && Object.keys($elseSch).length > 0 || $elseSch === false : it.util.schemaHasRules($elseSch, it.RULES.all)), $currentBaseId = $it.baseId;
    if ($thenPresent || $elsePresent) {
      var $ifClause;
      $it.createErrors = false;
      $it.schema = $schema;
      $it.schemaPath = $schemaPath;
      $it.errSchemaPath = $errSchemaPath;
      out += " var " + $errs + " = errors; var " + $valid + " = true;  ";
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      out += "  " + it.validate($it) + " ";
      $it.baseId = $currentBaseId;
      $it.createErrors = true;
      out += "  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; }  ";
      it.compositeRule = $it.compositeRule = $wasComposite;
      if ($thenPresent) {
        out += " if (" + $nextValid + ") {  ";
        $it.schema = it.schema["then"];
        $it.schemaPath = it.schemaPath + ".then";
        $it.errSchemaPath = it.errSchemaPath + "/then";
        out += "  " + it.validate($it) + " ";
        $it.baseId = $currentBaseId;
        out += " " + $valid + " = " + $nextValid + "; ";
        if ($thenPresent && $elsePresent) {
          $ifClause = "ifClause" + $lvl;
          out += " var " + $ifClause + " = 'then'; ";
        } else {
          $ifClause = "'then'";
        }
        out += " } ";
        if ($elsePresent) {
          out += " else { ";
        }
      } else {
        out += " if (!" + $nextValid + ") { ";
      }
      if ($elsePresent) {
        $it.schema = it.schema["else"];
        $it.schemaPath = it.schemaPath + ".else";
        $it.errSchemaPath = it.errSchemaPath + "/else";
        out += "  " + it.validate($it) + " ";
        $it.baseId = $currentBaseId;
        out += " " + $valid + " = " + $nextValid + "; ";
        if ($thenPresent && $elsePresent) {
          $ifClause = "ifClause" + $lvl;
          out += " var " + $ifClause + " = 'else'; ";
        } else {
          $ifClause = "'else'";
        }
        out += " } ";
      }
      out += " if (!" + $valid + ") {   var err =   ";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "if" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { failingKeyword: " + $ifClause + " } ";
        if (it.opts.messages !== false) {
          out += ` , message: 'should match "' + ` + $ifClause + ` + '" schema' `;
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError(vErrors); ";
        } else {
          out += " validate.errors = vErrors; return false; ";
        }
      }
      out += " }   ";
      if ($breakOnError) {
        out += " else { ";
      }
    } else {
      if ($breakOnError) {
        out += " if (true) { ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/items.js
var require_items = __commonJS((exports, module) => {
  module.exports = function generate_items(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $idx = "i" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $currentBaseId = it.baseId;
    out += "var " + $errs + " = errors;var " + $valid + ";";
    if (Array.isArray($schema)) {
      var $additionalItems = it.schema.additionalItems;
      if ($additionalItems === false) {
        out += " " + $valid + " = " + $data + ".length <= " + $schema.length + "; ";
        var $currErrSchemaPath = $errSchemaPath;
        $errSchemaPath = it.errSchemaPath + "/additionalItems";
        out += "  if (!" + $valid + ") {   ";
        var $$outStack = $$outStack || [];
        $$outStack.push(out);
        out = "";
        if (it.createErrors !== false) {
          out += " { keyword: '" + "additionalItems" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schema.length + " } ";
          if (it.opts.messages !== false) {
            out += " , message: 'should NOT have more than " + $schema.length + " items' ";
          }
          if (it.opts.verbose) {
            out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
          }
          out += " } ";
        } else {
          out += " {} ";
        }
        var __err = out;
        out = $$outStack.pop();
        if (!it.compositeRule && $breakOnError) {
          if (it.async) {
            out += " throw new ValidationError([" + __err + "]); ";
          } else {
            out += " validate.errors = [" + __err + "]; return false; ";
          }
        } else {
          out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        }
        out += " } ";
        $errSchemaPath = $currErrSchemaPath;
        if ($breakOnError) {
          $closingBraces += "}";
          out += " else { ";
        }
      }
      var arr1 = $schema;
      if (arr1) {
        var $sch, $i = -1, l1 = arr1.length - 1;
        while ($i < l1) {
          $sch = arr1[$i += 1];
          if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
            out += " " + $nextValid + " = true; if (" + $data + ".length > " + $i + ") { ";
            var $passData = $data + "[" + $i + "]";
            $it.schema = $sch;
            $it.schemaPath = $schemaPath + "[" + $i + "]";
            $it.errSchemaPath = $errSchemaPath + "/" + $i;
            $it.errorPath = it.util.getPathExpr(it.errorPath, $i, it.opts.jsonPointers, true);
            $it.dataPathArr[$dataNxt] = $i;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
              out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
              out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            out += " }  ";
            if ($breakOnError) {
              out += " if (" + $nextValid + ") { ";
              $closingBraces += "}";
            }
          }
        }
      }
      if (typeof $additionalItems == "object" && (it.opts.strictKeywords ? typeof $additionalItems == "object" && Object.keys($additionalItems).length > 0 || $additionalItems === false : it.util.schemaHasRules($additionalItems, it.RULES.all))) {
        $it.schema = $additionalItems;
        $it.schemaPath = it.schemaPath + ".additionalItems";
        $it.errSchemaPath = it.errSchemaPath + "/additionalItems";
        out += " " + $nextValid + " = true; if (" + $data + ".length > " + $schema.length + ") {  for (var " + $idx + " = " + $schema.length + "; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
        $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
        var $passData = $data + "[" + $idx + "]";
        $it.dataPathArr[$dataNxt] = $idx;
        var $code = it.validate($it);
        $it.baseId = $currentBaseId;
        if (it.util.varOccurences($code, $nextData) < 2) {
          out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
        } else {
          out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
        }
        if ($breakOnError) {
          out += " if (!" + $nextValid + ") break; ";
        }
        out += " } }  ";
        if ($breakOnError) {
          out += " if (" + $nextValid + ") { ";
          $closingBraces += "}";
        }
      }
    } else if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
      $it.schema = $schema;
      $it.schemaPath = $schemaPath;
      $it.errSchemaPath = $errSchemaPath;
      out += "  for (var " + $idx + " = " + 0 + "; " + $idx + " < " + $data + ".length; " + $idx + "++) { ";
      $it.errorPath = it.util.getPathExpr(it.errorPath, $idx, it.opts.jsonPointers, true);
      var $passData = $data + "[" + $idx + "]";
      $it.dataPathArr[$dataNxt] = $idx;
      var $code = it.validate($it);
      $it.baseId = $currentBaseId;
      if (it.util.varOccurences($code, $nextData) < 2) {
        out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
      } else {
        out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
      }
      if ($breakOnError) {
        out += " if (!" + $nextValid + ") break; ";
      }
      out += " }";
    }
    if ($breakOnError) {
      out += " " + $closingBraces + " if (" + $errs + " == errors) {";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/_limit.js
var require__limit = __commonJS((exports, module) => {
  module.exports = function generate__limit(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $errorKeyword;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $isMax = $keyword == "maximum", $exclusiveKeyword = $isMax ? "exclusiveMaximum" : "exclusiveMinimum", $schemaExcl = it.schema[$exclusiveKeyword], $isDataExcl = it.opts.$data && $schemaExcl && $schemaExcl.$data, $op = $isMax ? "<" : ">", $notOp = $isMax ? ">" : "<", $errorKeyword = undefined;
    if (!($isData || typeof $schema == "number" || $schema === undefined)) {
      throw new Error($keyword + " must be number");
    }
    if (!($isDataExcl || $schemaExcl === undefined || typeof $schemaExcl == "number" || typeof $schemaExcl == "boolean")) {
      throw new Error($exclusiveKeyword + " must be number or boolean");
    }
    if ($isDataExcl) {
      var $schemaValueExcl = it.util.getData($schemaExcl.$data, $dataLvl, it.dataPathArr), $exclusive = "exclusive" + $lvl, $exclType = "exclType" + $lvl, $exclIsNumber = "exclIsNumber" + $lvl, $opExpr = "op" + $lvl, $opStr = "' + " + $opExpr + " + '";
      out += " var schemaExcl" + $lvl + " = " + $schemaValueExcl + "; ";
      $schemaValueExcl = "schemaExcl" + $lvl;
      out += " var " + $exclusive + "; var " + $exclType + " = typeof " + $schemaValueExcl + "; if (" + $exclType + " != 'boolean' && " + $exclType + " != 'undefined' && " + $exclType + " != 'number') { ";
      var $errorKeyword = $exclusiveKeyword;
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      if (it.createErrors !== false) {
        out += " { keyword: '" + ($errorKeyword || "_exclusiveLimit") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
        if (it.opts.messages !== false) {
          out += " , message: '" + $exclusiveKeyword + " should be boolean' ";
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      var __err = out;
      out = $$outStack.pop();
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError([" + __err + "]); ";
        } else {
          out += " validate.errors = [" + __err + "]; return false; ";
        }
      } else {
        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      }
      out += " } else if ( ";
      if ($isData) {
        out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
      }
      out += " " + $exclType + " == 'number' ? ( (" + $exclusive + " = " + $schemaValue + " === undefined || " + $schemaValueExcl + " " + $op + "= " + $schemaValue + ") ? " + $data + " " + $notOp + "= " + $schemaValueExcl + " : " + $data + " " + $notOp + " " + $schemaValue + " ) : ( (" + $exclusive + " = " + $schemaValueExcl + " === true) ? " + $data + " " + $notOp + "= " + $schemaValue + " : " + $data + " " + $notOp + " " + $schemaValue + " ) || " + $data + " !== " + $data + ") { var op" + $lvl + " = " + $exclusive + " ? '" + $op + "' : '" + $op + "='; ";
      if ($schema === undefined) {
        $errorKeyword = $exclusiveKeyword;
        $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
        $schemaValue = $schemaValueExcl;
        $isData = $isDataExcl;
      }
    } else {
      var $exclIsNumber = typeof $schemaExcl == "number", $opStr = $op;
      if ($exclIsNumber && $isData) {
        var $opExpr = "'" + $opStr + "'";
        out += " if ( ";
        if ($isData) {
          out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
        }
        out += " ( " + $schemaValue + " === undefined || " + $schemaExcl + " " + $op + "= " + $schemaValue + " ? " + $data + " " + $notOp + "= " + $schemaExcl + " : " + $data + " " + $notOp + " " + $schemaValue + " ) || " + $data + " !== " + $data + ") { ";
      } else {
        if ($exclIsNumber && $schema === undefined) {
          $exclusive = true;
          $errorKeyword = $exclusiveKeyword;
          $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
          $schemaValue = $schemaExcl;
          $notOp += "=";
        } else {
          if ($exclIsNumber)
            $schemaValue = Math[$isMax ? "min" : "max"]($schemaExcl, $schema);
          if ($schemaExcl === ($exclIsNumber ? $schemaValue : true)) {
            $exclusive = true;
            $errorKeyword = $exclusiveKeyword;
            $errSchemaPath = it.errSchemaPath + "/" + $exclusiveKeyword;
            $notOp += "=";
          } else {
            $exclusive = false;
            $opStr += "=";
          }
        }
        var $opExpr = "'" + $opStr + "'";
        out += " if ( ";
        if ($isData) {
          out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
        }
        out += " " + $data + " " + $notOp + " " + $schemaValue + " || " + $data + " !== " + $data + ") { ";
      }
    }
    $errorKeyword = $errorKeyword || $keyword;
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + ($errorKeyword || "_limit") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { comparison: " + $opExpr + ", limit: " + $schemaValue + ", exclusive: " + $exclusive + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should be " + $opStr + " ";
        if ($isData) {
          out += "' + " + $schemaValue;
        } else {
          out += "" + $schemaValue + "'";
        }
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + $schema;
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += " } ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/_limitItems.js
var require__limitItems = __commonJS((exports, module) => {
  module.exports = function generate__limitItems(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $errorKeyword;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (!($isData || typeof $schema == "number")) {
      throw new Error($keyword + " must be number");
    }
    var $op = $keyword == "maxItems" ? ">" : "<";
    out += "if ( ";
    if ($isData) {
      out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
    }
    out += " " + $data + ".length " + $op + " " + $schemaValue + ") { ";
    var $errorKeyword = $keyword;
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + ($errorKeyword || "_limitItems") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should NOT have ";
        if ($keyword == "maxItems") {
          out += "more";
        } else {
          out += "fewer";
        }
        out += " than ";
        if ($isData) {
          out += "' + " + $schemaValue + " + '";
        } else {
          out += "" + $schema;
        }
        out += " items' ";
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + $schema;
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += "} ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/_limitLength.js
var require__limitLength = __commonJS((exports, module) => {
  module.exports = function generate__limitLength(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $errorKeyword;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (!($isData || typeof $schema == "number")) {
      throw new Error($keyword + " must be number");
    }
    var $op = $keyword == "maxLength" ? ">" : "<";
    out += "if ( ";
    if ($isData) {
      out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
    }
    if (it.opts.unicode === false) {
      out += " " + $data + ".length ";
    } else {
      out += " ucs2length(" + $data + ") ";
    }
    out += " " + $op + " " + $schemaValue + ") { ";
    var $errorKeyword = $keyword;
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + ($errorKeyword || "_limitLength") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should NOT be ";
        if ($keyword == "maxLength") {
          out += "longer";
        } else {
          out += "shorter";
        }
        out += " than ";
        if ($isData) {
          out += "' + " + $schemaValue + " + '";
        } else {
          out += "" + $schema;
        }
        out += " characters' ";
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + $schema;
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += "} ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/_limitProperties.js
var require__limitProperties = __commonJS((exports, module) => {
  module.exports = function generate__limitProperties(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $errorKeyword;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (!($isData || typeof $schema == "number")) {
      throw new Error($keyword + " must be number");
    }
    var $op = $keyword == "maxProperties" ? ">" : "<";
    out += "if ( ";
    if ($isData) {
      out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'number') || ";
    }
    out += " Object.keys(" + $data + ").length " + $op + " " + $schemaValue + ") { ";
    var $errorKeyword = $keyword;
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + ($errorKeyword || "_limitProperties") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { limit: " + $schemaValue + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should NOT have ";
        if ($keyword == "maxProperties") {
          out += "more";
        } else {
          out += "fewer";
        }
        out += " than ";
        if ($isData) {
          out += "' + " + $schemaValue + " + '";
        } else {
          out += "" + $schema;
        }
        out += " properties' ";
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + $schema;
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += "} ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/multipleOf.js
var require_multipleOf = __commonJS((exports, module) => {
  module.exports = function generate_multipleOf(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (!($isData || typeof $schema == "number")) {
      throw new Error($keyword + " must be number");
    }
    out += "var division" + $lvl + ";if (";
    if ($isData) {
      out += " " + $schemaValue + " !== undefined && ( typeof " + $schemaValue + " != 'number' || ";
    }
    out += " (division" + $lvl + " = " + $data + " / " + $schemaValue + ", ";
    if (it.opts.multipleOfPrecision) {
      out += " Math.abs(Math.round(division" + $lvl + ") - division" + $lvl + ") > 1e-" + it.opts.multipleOfPrecision + " ";
    } else {
      out += " division" + $lvl + " !== parseInt(division" + $lvl + ") ";
    }
    out += " ) ";
    if ($isData) {
      out += "  )  ";
    }
    out += " ) {   ";
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "multipleOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { multipleOf: " + $schemaValue + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should be multiple of ";
        if ($isData) {
          out += "' + " + $schemaValue;
        } else {
          out += "" + $schemaValue + "'";
        }
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + $schema;
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += "} ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/not.js
var require_not = __commonJS((exports, module) => {
  module.exports = function generate_not(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    $it.level++;
    var $nextValid = "valid" + $it.level;
    if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
      $it.schema = $schema;
      $it.schemaPath = $schemaPath;
      $it.errSchemaPath = $errSchemaPath;
      out += " var " + $errs + " = errors;  ";
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      $it.createErrors = false;
      var $allErrorsOption;
      if ($it.opts.allErrors) {
        $allErrorsOption = $it.opts.allErrors;
        $it.opts.allErrors = false;
      }
      out += " " + it.validate($it) + " ";
      $it.createErrors = true;
      if ($allErrorsOption)
        $it.opts.allErrors = $allErrorsOption;
      it.compositeRule = $it.compositeRule = $wasComposite;
      out += " if (" + $nextValid + ") {   ";
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "not" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
        if (it.opts.messages !== false) {
          out += " , message: 'should NOT be valid' ";
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      var __err = out;
      out = $$outStack.pop();
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError([" + __err + "]); ";
        } else {
          out += " validate.errors = [" + __err + "]; return false; ";
        }
      } else {
        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      }
      out += " } else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; } ";
      if (it.opts.allErrors) {
        out += " } ";
      }
    } else {
      out += "  var err =   ";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "not" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: {} ";
        if (it.opts.messages !== false) {
          out += " , message: 'should NOT be valid' ";
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      if ($breakOnError) {
        out += " if (false) { ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/oneOf.js
var require_oneOf = __commonJS((exports, module) => {
  module.exports = function generate_oneOf(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $currentBaseId = $it.baseId, $prevValid = "prevValid" + $lvl, $passingSchemas = "passingSchemas" + $lvl;
    out += "var " + $errs + " = errors , " + $prevValid + " = false , " + $valid + " = false , " + $passingSchemas + " = null; ";
    var $wasComposite = it.compositeRule;
    it.compositeRule = $it.compositeRule = true;
    var arr1 = $schema;
    if (arr1) {
      var $sch, $i = -1, l1 = arr1.length - 1;
      while ($i < l1) {
        $sch = arr1[$i += 1];
        if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
          $it.schema = $sch;
          $it.schemaPath = $schemaPath + "[" + $i + "]";
          $it.errSchemaPath = $errSchemaPath + "/" + $i;
          out += "  " + it.validate($it) + " ";
          $it.baseId = $currentBaseId;
        } else {
          out += " var " + $nextValid + " = true; ";
        }
        if ($i) {
          out += " if (" + $nextValid + " && " + $prevValid + ") { " + $valid + " = false; " + $passingSchemas + " = [" + $passingSchemas + ", " + $i + "]; } else { ";
          $closingBraces += "}";
        }
        out += " if (" + $nextValid + ") { " + $valid + " = " + $prevValid + " = true; " + $passingSchemas + " = " + $i + "; }";
      }
    }
    it.compositeRule = $it.compositeRule = $wasComposite;
    out += "" + $closingBraces + "if (!" + $valid + ") {   var err =   ";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "oneOf" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { passingSchemas: " + $passingSchemas + " } ";
      if (it.opts.messages !== false) {
        out += " , message: 'should match exactly one schema in oneOf' ";
      }
      if (it.opts.verbose) {
        out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError(vErrors); ";
      } else {
        out += " validate.errors = vErrors; return false; ";
      }
    }
    out += "} else {  errors = " + $errs + "; if (vErrors !== null) { if (" + $errs + ") vErrors.length = " + $errs + "; else vErrors = null; }";
    if (it.opts.allErrors) {
      out += " } ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/pattern.js
var require_pattern = __commonJS((exports, module) => {
  module.exports = function generate_pattern(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $regexp = $isData ? "(new RegExp(" + $schemaValue + "))" : it.usePattern($schema);
    out += "if ( ";
    if ($isData) {
      out += " (" + $schemaValue + " !== undefined && typeof " + $schemaValue + " != 'string') || ";
    }
    out += " !" + $regexp + ".test(" + $data + ") ) {   ";
    var $$outStack = $$outStack || [];
    $$outStack.push(out);
    out = "";
    if (it.createErrors !== false) {
      out += " { keyword: '" + "pattern" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { pattern:  ";
      if ($isData) {
        out += "" + $schemaValue;
      } else {
        out += "" + it.util.toQuotedString($schema);
      }
      out += "  } ";
      if (it.opts.messages !== false) {
        out += ` , message: 'should match pattern "`;
        if ($isData) {
          out += "' + " + $schemaValue + " + '";
        } else {
          out += "" + it.util.escapeQuotes($schema);
        }
        out += `"' `;
      }
      if (it.opts.verbose) {
        out += " , schema:  ";
        if ($isData) {
          out += "validate.schema" + $schemaPath;
        } else {
          out += "" + it.util.toQuotedString($schema);
        }
        out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
      }
      out += " } ";
    } else {
      out += " {} ";
    }
    var __err = out;
    out = $$outStack.pop();
    if (!it.compositeRule && $breakOnError) {
      if (it.async) {
        out += " throw new ValidationError([" + __err + "]); ";
      } else {
        out += " validate.errors = [" + __err + "]; return false; ";
      }
    } else {
      out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
    }
    out += "} ";
    if ($breakOnError) {
      out += " else { ";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/properties.js
var require_properties = __commonJS((exports, module) => {
  module.exports = function generate_properties(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    var $key = "key" + $lvl, $idx = "idx" + $lvl, $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $dataProperties = "dataProperties" + $lvl;
    var $schemaKeys = Object.keys($schema || {}).filter(notProto), $pProperties = it.schema.patternProperties || {}, $pPropertyKeys = Object.keys($pProperties).filter(notProto), $aProperties = it.schema.additionalProperties, $someProperties = $schemaKeys.length || $pPropertyKeys.length, $noAdditional = $aProperties === false, $additionalIsSchema = typeof $aProperties == "object" && Object.keys($aProperties).length, $removeAdditional = it.opts.removeAdditional, $checkAdditional = $noAdditional || $additionalIsSchema || $removeAdditional, $ownProperties = it.opts.ownProperties, $currentBaseId = it.baseId;
    var $required = it.schema.required;
    if ($required && !(it.opts.$data && $required.$data) && $required.length < it.opts.loopRequired) {
      var $requiredHash = it.util.toHash($required);
    }
    function notProto(p) {
      return p !== "__proto__";
    }
    out += "var " + $errs + " = errors;var " + $nextValid + " = true;";
    if ($ownProperties) {
      out += " var " + $dataProperties + " = undefined;";
    }
    if ($checkAdditional) {
      if ($ownProperties) {
        out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
      } else {
        out += " for (var " + $key + " in " + $data + ") { ";
      }
      if ($someProperties) {
        out += " var isAdditional" + $lvl + " = !(false ";
        if ($schemaKeys.length) {
          if ($schemaKeys.length > 8) {
            out += " || validate.schema" + $schemaPath + ".hasOwnProperty(" + $key + ") ";
          } else {
            var arr1 = $schemaKeys;
            if (arr1) {
              var $propertyKey, i1 = -1, l1 = arr1.length - 1;
              while (i1 < l1) {
                $propertyKey = arr1[i1 += 1];
                out += " || " + $key + " == " + it.util.toQuotedString($propertyKey) + " ";
              }
            }
          }
        }
        if ($pPropertyKeys.length) {
          var arr2 = $pPropertyKeys;
          if (arr2) {
            var $pProperty, $i = -1, l2 = arr2.length - 1;
            while ($i < l2) {
              $pProperty = arr2[$i += 1];
              out += " || " + it.usePattern($pProperty) + ".test(" + $key + ") ";
            }
          }
        }
        out += " ); if (isAdditional" + $lvl + ") { ";
      }
      if ($removeAdditional == "all") {
        out += " delete " + $data + "[" + $key + "]; ";
      } else {
        var $currentErrorPath = it.errorPath;
        var $additionalProperty = "' + " + $key + " + '";
        if (it.opts._errorDataPathProperty) {
          it.errorPath = it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
        }
        if ($noAdditional) {
          if ($removeAdditional) {
            out += " delete " + $data + "[" + $key + "]; ";
          } else {
            out += " " + $nextValid + " = false; ";
            var $currErrSchemaPath = $errSchemaPath;
            $errSchemaPath = it.errSchemaPath + "/additionalProperties";
            var $$outStack = $$outStack || [];
            $$outStack.push(out);
            out = "";
            if (it.createErrors !== false) {
              out += " { keyword: '" + "additionalProperties" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { additionalProperty: '" + $additionalProperty + "' } ";
              if (it.opts.messages !== false) {
                out += " , message: '";
                if (it.opts._errorDataPathProperty) {
                  out += "is an invalid additional property";
                } else {
                  out += "should NOT have additional properties";
                }
                out += "' ";
              }
              if (it.opts.verbose) {
                out += " , schema: false , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            var __err = out;
            out = $$outStack.pop();
            if (!it.compositeRule && $breakOnError) {
              if (it.async) {
                out += " throw new ValidationError([" + __err + "]); ";
              } else {
                out += " validate.errors = [" + __err + "]; return false; ";
              }
            } else {
              out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
            }
            $errSchemaPath = $currErrSchemaPath;
            if ($breakOnError) {
              out += " break; ";
            }
          }
        } else if ($additionalIsSchema) {
          if ($removeAdditional == "failing") {
            out += " var " + $errs + " = errors;  ";
            var $wasComposite = it.compositeRule;
            it.compositeRule = $it.compositeRule = true;
            $it.schema = $aProperties;
            $it.schemaPath = it.schemaPath + ".additionalProperties";
            $it.errSchemaPath = it.errSchemaPath + "/additionalProperties";
            $it.errorPath = it.opts._errorDataPathProperty ? it.errorPath : it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
            var $passData = $data + "[" + $key + "]";
            $it.dataPathArr[$dataNxt] = $key;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
              out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
              out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            out += " if (!" + $nextValid + ") { errors = " + $errs + "; if (validate.errors !== null) { if (errors) validate.errors.length = errors; else validate.errors = null; } delete " + $data + "[" + $key + "]; }  ";
            it.compositeRule = $it.compositeRule = $wasComposite;
          } else {
            $it.schema = $aProperties;
            $it.schemaPath = it.schemaPath + ".additionalProperties";
            $it.errSchemaPath = it.errSchemaPath + "/additionalProperties";
            $it.errorPath = it.opts._errorDataPathProperty ? it.errorPath : it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
            var $passData = $data + "[" + $key + "]";
            $it.dataPathArr[$dataNxt] = $key;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
              out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
              out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            if ($breakOnError) {
              out += " if (!" + $nextValid + ") break; ";
            }
          }
        }
        it.errorPath = $currentErrorPath;
      }
      if ($someProperties) {
        out += " } ";
      }
      out += " }  ";
      if ($breakOnError) {
        out += " if (" + $nextValid + ") { ";
        $closingBraces += "}";
      }
    }
    var $useDefaults = it.opts.useDefaults && !it.compositeRule;
    if ($schemaKeys.length) {
      var arr3 = $schemaKeys;
      if (arr3) {
        var $propertyKey, i3 = -1, l3 = arr3.length - 1;
        while (i3 < l3) {
          $propertyKey = arr3[i3 += 1];
          var $sch = $schema[$propertyKey];
          if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
            var $prop = it.util.getProperty($propertyKey), $passData = $data + $prop, $hasDefault = $useDefaults && $sch.default !== undefined;
            $it.schema = $sch;
            $it.schemaPath = $schemaPath + $prop;
            $it.errSchemaPath = $errSchemaPath + "/" + it.util.escapeFragment($propertyKey);
            $it.errorPath = it.util.getPath(it.errorPath, $propertyKey, it.opts.jsonPointers);
            $it.dataPathArr[$dataNxt] = it.util.toQuotedString($propertyKey);
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
              $code = it.util.varReplace($code, $nextData, $passData);
              var $useData = $passData;
            } else {
              var $useData = $nextData;
              out += " var " + $nextData + " = " + $passData + "; ";
            }
            if ($hasDefault) {
              out += " " + $code + " ";
            } else {
              if ($requiredHash && $requiredHash[$propertyKey]) {
                out += " if ( " + $useData + " === undefined ";
                if ($ownProperties) {
                  out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                }
                out += ") { " + $nextValid + " = false; ";
                var $currentErrorPath = it.errorPath, $currErrSchemaPath = $errSchemaPath, $missingProperty = it.util.escapeQuotes($propertyKey);
                if (it.opts._errorDataPathProperty) {
                  it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
                }
                $errSchemaPath = it.errSchemaPath + "/required";
                var $$outStack = $$outStack || [];
                $$outStack.push(out);
                out = "";
                if (it.createErrors !== false) {
                  out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                  if (it.opts.messages !== false) {
                    out += " , message: '";
                    if (it.opts._errorDataPathProperty) {
                      out += "is a required property";
                    } else {
                      out += "should have required property \\'" + $missingProperty + "\\'";
                    }
                    out += "' ";
                  }
                  if (it.opts.verbose) {
                    out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                  }
                  out += " } ";
                } else {
                  out += " {} ";
                }
                var __err = out;
                out = $$outStack.pop();
                if (!it.compositeRule && $breakOnError) {
                  if (it.async) {
                    out += " throw new ValidationError([" + __err + "]); ";
                  } else {
                    out += " validate.errors = [" + __err + "]; return false; ";
                  }
                } else {
                  out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
                }
                $errSchemaPath = $currErrSchemaPath;
                it.errorPath = $currentErrorPath;
                out += " } else { ";
              } else {
                if ($breakOnError) {
                  out += " if ( " + $useData + " === undefined ";
                  if ($ownProperties) {
                    out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                  }
                  out += ") { " + $nextValid + " = true; } else { ";
                } else {
                  out += " if (" + $useData + " !== undefined ";
                  if ($ownProperties) {
                    out += " &&   Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
                  }
                  out += " ) { ";
                }
              }
              out += " " + $code + " } ";
            }
          }
          if ($breakOnError) {
            out += " if (" + $nextValid + ") { ";
            $closingBraces += "}";
          }
        }
      }
    }
    if ($pPropertyKeys.length) {
      var arr4 = $pPropertyKeys;
      if (arr4) {
        var $pProperty, i4 = -1, l4 = arr4.length - 1;
        while (i4 < l4) {
          $pProperty = arr4[i4 += 1];
          var $sch = $pProperties[$pProperty];
          if (it.opts.strictKeywords ? typeof $sch == "object" && Object.keys($sch).length > 0 || $sch === false : it.util.schemaHasRules($sch, it.RULES.all)) {
            $it.schema = $sch;
            $it.schemaPath = it.schemaPath + ".patternProperties" + it.util.getProperty($pProperty);
            $it.errSchemaPath = it.errSchemaPath + "/patternProperties/" + it.util.escapeFragment($pProperty);
            if ($ownProperties) {
              out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
            } else {
              out += " for (var " + $key + " in " + $data + ") { ";
            }
            out += " if (" + it.usePattern($pProperty) + ".test(" + $key + ")) { ";
            $it.errorPath = it.util.getPathExpr(it.errorPath, $key, it.opts.jsonPointers);
            var $passData = $data + "[" + $key + "]";
            $it.dataPathArr[$dataNxt] = $key;
            var $code = it.validate($it);
            $it.baseId = $currentBaseId;
            if (it.util.varOccurences($code, $nextData) < 2) {
              out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
            } else {
              out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
            }
            if ($breakOnError) {
              out += " if (!" + $nextValid + ") break; ";
            }
            out += " } ";
            if ($breakOnError) {
              out += " else " + $nextValid + " = true; ";
            }
            out += " }  ";
            if ($breakOnError) {
              out += " if (" + $nextValid + ") { ";
              $closingBraces += "}";
            }
          }
        }
      }
    }
    if ($breakOnError) {
      out += " " + $closingBraces + " if (" + $errs + " == errors) {";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/propertyNames.js
var require_propertyNames = __commonJS((exports, module) => {
  module.exports = function generate_propertyNames(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $errs = "errs__" + $lvl;
    var $it = it.util.copy(it);
    var $closingBraces = "";
    $it.level++;
    var $nextValid = "valid" + $it.level;
    out += "var " + $errs + " = errors;";
    if (it.opts.strictKeywords ? typeof $schema == "object" && Object.keys($schema).length > 0 || $schema === false : it.util.schemaHasRules($schema, it.RULES.all)) {
      $it.schema = $schema;
      $it.schemaPath = $schemaPath;
      $it.errSchemaPath = $errSchemaPath;
      var $key = "key" + $lvl, $idx = "idx" + $lvl, $i = "i" + $lvl, $invalidName = "' + " + $key + " + '", $dataNxt = $it.dataLevel = it.dataLevel + 1, $nextData = "data" + $dataNxt, $dataProperties = "dataProperties" + $lvl, $ownProperties = it.opts.ownProperties, $currentBaseId = it.baseId;
      if ($ownProperties) {
        out += " var " + $dataProperties + " = undefined; ";
      }
      if ($ownProperties) {
        out += " " + $dataProperties + " = " + $dataProperties + " || Object.keys(" + $data + "); for (var " + $idx + "=0; " + $idx + "<" + $dataProperties + ".length; " + $idx + "++) { var " + $key + " = " + $dataProperties + "[" + $idx + "]; ";
      } else {
        out += " for (var " + $key + " in " + $data + ") { ";
      }
      out += " var startErrs" + $lvl + " = errors; ";
      var $passData = $key;
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      var $code = it.validate($it);
      $it.baseId = $currentBaseId;
      if (it.util.varOccurences($code, $nextData) < 2) {
        out += " " + it.util.varReplace($code, $nextData, $passData) + " ";
      } else {
        out += " var " + $nextData + " = " + $passData + "; " + $code + " ";
      }
      it.compositeRule = $it.compositeRule = $wasComposite;
      out += " if (!" + $nextValid + ") { for (var " + $i + "=startErrs" + $lvl + "; " + $i + "<errors; " + $i + "++) { vErrors[" + $i + "].propertyName = " + $key + "; }   var err =   ";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "propertyNames" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { propertyName: '" + $invalidName + "' } ";
        if (it.opts.messages !== false) {
          out += " , message: 'property name \\'" + $invalidName + "\\' is invalid' ";
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError(vErrors); ";
        } else {
          out += " validate.errors = vErrors; return false; ";
        }
      }
      if ($breakOnError) {
        out += " break; ";
      }
      out += " } }";
    }
    if ($breakOnError) {
      out += " " + $closingBraces + " if (" + $errs + " == errors) {";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/required.js
var require_required = __commonJS((exports, module) => {
  module.exports = function generate_required(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $vSchema = "schema" + $lvl;
    if (!$isData) {
      if ($schema.length < it.opts.loopRequired && it.schema.properties && Object.keys(it.schema.properties).length) {
        var $required = [];
        var arr1 = $schema;
        if (arr1) {
          var $property, i1 = -1, l1 = arr1.length - 1;
          while (i1 < l1) {
            $property = arr1[i1 += 1];
            var $propertySch = it.schema.properties[$property];
            if (!($propertySch && (it.opts.strictKeywords ? typeof $propertySch == "object" && Object.keys($propertySch).length > 0 || $propertySch === false : it.util.schemaHasRules($propertySch, it.RULES.all)))) {
              $required[$required.length] = $property;
            }
          }
        }
      } else {
        var $required = $schema;
      }
    }
    if ($isData || $required.length) {
      var $currentErrorPath = it.errorPath, $loopRequired = $isData || $required.length >= it.opts.loopRequired, $ownProperties = it.opts.ownProperties;
      if ($breakOnError) {
        out += " var missing" + $lvl + "; ";
        if ($loopRequired) {
          if (!$isData) {
            out += " var " + $vSchema + " = validate.schema" + $schemaPath + "; ";
          }
          var $i = "i" + $lvl, $propertyPath = "schema" + $lvl + "[" + $i + "]", $missingProperty = "' + " + $propertyPath + " + '";
          if (it.opts._errorDataPathProperty) {
            it.errorPath = it.util.getPathExpr($currentErrorPath, $propertyPath, it.opts.jsonPointers);
          }
          out += " var " + $valid + " = true; ";
          if ($isData) {
            out += " if (schema" + $lvl + " === undefined) " + $valid + " = true; else if (!Array.isArray(schema" + $lvl + ")) " + $valid + " = false; else {";
          }
          out += " for (var " + $i + " = 0; " + $i + " < " + $vSchema + ".length; " + $i + "++) { " + $valid + " = " + $data + "[" + $vSchema + "[" + $i + "]] !== undefined ";
          if ($ownProperties) {
            out += " &&   Object.prototype.hasOwnProperty.call(" + $data + ", " + $vSchema + "[" + $i + "]) ";
          }
          out += "; if (!" + $valid + ") break; } ";
          if ($isData) {
            out += "  }  ";
          }
          out += "  if (!" + $valid + ") {   ";
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
            if (it.opts.messages !== false) {
              out += " , message: '";
              if (it.opts._errorDataPathProperty) {
                out += "is a required property";
              } else {
                out += "should have required property \\'" + $missingProperty + "\\'";
              }
              out += "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
          out += " } else { ";
        } else {
          out += " if ( ";
          var arr2 = $required;
          if (arr2) {
            var $propertyKey, $i = -1, l2 = arr2.length - 1;
            while ($i < l2) {
              $propertyKey = arr2[$i += 1];
              if ($i) {
                out += " || ";
              }
              var $prop = it.util.getProperty($propertyKey), $useData = $data + $prop;
              out += " ( ( " + $useData + " === undefined ";
              if ($ownProperties) {
                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
              }
              out += ") && (missing" + $lvl + " = " + it.util.toQuotedString(it.opts.jsonPointers ? $propertyKey : $prop) + ") ) ";
            }
          }
          out += ") {  ";
          var $propertyPath = "missing" + $lvl, $missingProperty = "' + " + $propertyPath + " + '";
          if (it.opts._errorDataPathProperty) {
            it.errorPath = it.opts.jsonPointers ? it.util.getPathExpr($currentErrorPath, $propertyPath, true) : $currentErrorPath + " + " + $propertyPath;
          }
          var $$outStack = $$outStack || [];
          $$outStack.push(out);
          out = "";
          if (it.createErrors !== false) {
            out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
            if (it.opts.messages !== false) {
              out += " , message: '";
              if (it.opts._errorDataPathProperty) {
                out += "is a required property";
              } else {
                out += "should have required property \\'" + $missingProperty + "\\'";
              }
              out += "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          var __err = out;
          out = $$outStack.pop();
          if (!it.compositeRule && $breakOnError) {
            if (it.async) {
              out += " throw new ValidationError([" + __err + "]); ";
            } else {
              out += " validate.errors = [" + __err + "]; return false; ";
            }
          } else {
            out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
          }
          out += " } else { ";
        }
      } else {
        if ($loopRequired) {
          if (!$isData) {
            out += " var " + $vSchema + " = validate.schema" + $schemaPath + "; ";
          }
          var $i = "i" + $lvl, $propertyPath = "schema" + $lvl + "[" + $i + "]", $missingProperty = "' + " + $propertyPath + " + '";
          if (it.opts._errorDataPathProperty) {
            it.errorPath = it.util.getPathExpr($currentErrorPath, $propertyPath, it.opts.jsonPointers);
          }
          if ($isData) {
            out += " if (" + $vSchema + " && !Array.isArray(" + $vSchema + ")) {  var err =   ";
            if (it.createErrors !== false) {
              out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
              if (it.opts.messages !== false) {
                out += " , message: '";
                if (it.opts._errorDataPathProperty) {
                  out += "is a required property";
                } else {
                  out += "should have required property \\'" + $missingProperty + "\\'";
                }
                out += "' ";
              }
              if (it.opts.verbose) {
                out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
              }
              out += " } ";
            } else {
              out += " {} ";
            }
            out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } else if (" + $vSchema + " !== undefined) { ";
          }
          out += " for (var " + $i + " = 0; " + $i + " < " + $vSchema + ".length; " + $i + "++) { if (" + $data + "[" + $vSchema + "[" + $i + "]] === undefined ";
          if ($ownProperties) {
            out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", " + $vSchema + "[" + $i + "]) ";
          }
          out += ") {  var err =   ";
          if (it.createErrors !== false) {
            out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
            if (it.opts.messages !== false) {
              out += " , message: '";
              if (it.opts._errorDataPathProperty) {
                out += "is a required property";
              } else {
                out += "should have required property \\'" + $missingProperty + "\\'";
              }
              out += "' ";
            }
            if (it.opts.verbose) {
              out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
            }
            out += " } ";
          } else {
            out += " {} ";
          }
          out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } } ";
          if ($isData) {
            out += "  }  ";
          }
        } else {
          var arr3 = $required;
          if (arr3) {
            var $propertyKey, i3 = -1, l3 = arr3.length - 1;
            while (i3 < l3) {
              $propertyKey = arr3[i3 += 1];
              var $prop = it.util.getProperty($propertyKey), $missingProperty = it.util.escapeQuotes($propertyKey), $useData = $data + $prop;
              if (it.opts._errorDataPathProperty) {
                it.errorPath = it.util.getPath($currentErrorPath, $propertyKey, it.opts.jsonPointers);
              }
              out += " if ( " + $useData + " === undefined ";
              if ($ownProperties) {
                out += " || ! Object.prototype.hasOwnProperty.call(" + $data + ", '" + it.util.escapeQuotes($propertyKey) + "') ";
              }
              out += ") {  var err =   ";
              if (it.createErrors !== false) {
                out += " { keyword: '" + "required" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { missingProperty: '" + $missingProperty + "' } ";
                if (it.opts.messages !== false) {
                  out += " , message: '";
                  if (it.opts._errorDataPathProperty) {
                    out += "is a required property";
                  } else {
                    out += "should have required property \\'" + $missingProperty + "\\'";
                  }
                  out += "' ";
                }
                if (it.opts.verbose) {
                  out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
                }
                out += " } ";
              } else {
                out += " {} ";
              }
              out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; } ";
            }
          }
        }
      }
      it.errorPath = $currentErrorPath;
    } else if ($breakOnError) {
      out += " if (true) {";
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/uniqueItems.js
var require_uniqueItems = __commonJS((exports, module) => {
  module.exports = function generate_uniqueItems(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    if (($schema || $isData) && it.opts.uniqueItems !== false) {
      if ($isData) {
        out += " var " + $valid + "; if (" + $schemaValue + " === false || " + $schemaValue + " === undefined) " + $valid + " = true; else if (typeof " + $schemaValue + " != 'boolean') " + $valid + " = false; else { ";
      }
      out += " var i = " + $data + ".length , " + $valid + " = true , j; if (i > 1) { ";
      var $itemType = it.schema.items && it.schema.items.type, $typeIsArray = Array.isArray($itemType);
      if (!$itemType || $itemType == "object" || $itemType == "array" || $typeIsArray && ($itemType.indexOf("object") >= 0 || $itemType.indexOf("array") >= 0)) {
        out += " outer: for (;i--;) { for (j = i; j--;) { if (equal(" + $data + "[i], " + $data + "[j])) { " + $valid + " = false; break outer; } } } ";
      } else {
        out += " var itemIndices = {}, item; for (;i--;) { var item = " + $data + "[i]; ";
        var $method = "checkDataType" + ($typeIsArray ? "s" : "");
        out += " if (" + it.util[$method]($itemType, "item", it.opts.strictNumbers, true) + ") continue; ";
        if ($typeIsArray) {
          out += ` if (typeof item == 'string') item = '"' + item; `;
        }
        out += " if (typeof itemIndices[item] == 'number') { " + $valid + " = false; j = itemIndices[item]; break; } itemIndices[item] = i; } ";
      }
      out += " } ";
      if ($isData) {
        out += "  }  ";
      }
      out += " if (!" + $valid + ") {   ";
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      if (it.createErrors !== false) {
        out += " { keyword: '" + "uniqueItems" + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { i: i, j: j } ";
        if (it.opts.messages !== false) {
          out += " , message: 'should NOT have duplicate items (items ## ' + j + ' and ' + i + ' are identical)' ";
        }
        if (it.opts.verbose) {
          out += " , schema:  ";
          if ($isData) {
            out += "validate.schema" + $schemaPath;
          } else {
            out += "" + $schema;
          }
          out += "         , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      var __err = out;
      out = $$outStack.pop();
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError([" + __err + "]); ";
        } else {
          out += " validate.errors = [" + __err + "]; return false; ";
        }
      } else {
        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      }
      out += " } ";
      if ($breakOnError) {
        out += " else { ";
      }
    } else {
      if ($breakOnError) {
        out += " if (true) { ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/dotjs/index.js
var require_dotjs = __commonJS((exports, module) => {
  module.exports = {
    $ref: require_ref(),
    allOf: require_allOf(),
    anyOf: require_anyOf(),
    $comment: require_comment(),
    const: require_const(),
    contains: require_contains(),
    dependencies: require_dependencies(),
    enum: require_enum(),
    format: require_format(),
    if: require_if(),
    items: require_items(),
    maximum: require__limit(),
    minimum: require__limit(),
    maxItems: require__limitItems(),
    minItems: require__limitItems(),
    maxLength: require__limitLength(),
    minLength: require__limitLength(),
    maxProperties: require__limitProperties(),
    minProperties: require__limitProperties(),
    multipleOf: require_multipleOf(),
    not: require_not(),
    oneOf: require_oneOf(),
    pattern: require_pattern(),
    properties: require_properties(),
    propertyNames: require_propertyNames(),
    required: require_required(),
    uniqueItems: require_uniqueItems(),
    validate: require_validate()
  };
});

// node_modules/ajv/lib/compile/rules.js
var require_rules = __commonJS((exports, module) => {
  var ruleModules = require_dotjs();
  var toHash = require_util().toHash;
  module.exports = function rules() {
    var RULES = [
      {
        type: "number",
        rules: [
          { maximum: ["exclusiveMaximum"] },
          { minimum: ["exclusiveMinimum"] },
          "multipleOf",
          "format"
        ]
      },
      {
        type: "string",
        rules: ["maxLength", "minLength", "pattern", "format"]
      },
      {
        type: "array",
        rules: ["maxItems", "minItems", "items", "contains", "uniqueItems"]
      },
      {
        type: "object",
        rules: [
          "maxProperties",
          "minProperties",
          "required",
          "dependencies",
          "propertyNames",
          { properties: ["additionalProperties", "patternProperties"] }
        ]
      },
      { rules: ["$ref", "const", "enum", "not", "anyOf", "oneOf", "allOf", "if"] }
    ];
    var ALL = ["type", "$comment"];
    var KEYWORDS = [
      "$schema",
      "$id",
      "id",
      "$data",
      "$async",
      "title",
      "description",
      "default",
      "definitions",
      "examples",
      "readOnly",
      "writeOnly",
      "contentMediaType",
      "contentEncoding",
      "additionalItems",
      "then",
      "else"
    ];
    var TYPES = ["number", "integer", "string", "array", "object", "boolean", "null"];
    RULES.all = toHash(ALL);
    RULES.types = toHash(TYPES);
    RULES.forEach(function(group) {
      group.rules = group.rules.map(function(keyword) {
        var implKeywords;
        if (typeof keyword == "object") {
          var key = Object.keys(keyword)[0];
          implKeywords = keyword[key];
          keyword = key;
          implKeywords.forEach(function(k) {
            ALL.push(k);
            RULES.all[k] = true;
          });
        }
        ALL.push(keyword);
        var rule = RULES.all[keyword] = {
          keyword,
          code: ruleModules[keyword],
          implements: implKeywords
        };
        return rule;
      });
      RULES.all.$comment = {
        keyword: "$comment",
        code: ruleModules.$comment
      };
      if (group.type)
        RULES.types[group.type] = group;
    });
    RULES.keywords = toHash(ALL.concat(KEYWORDS));
    RULES.custom = {};
    return RULES;
  };
});

// node_modules/ajv/lib/data.js
var require_data = __commonJS((exports, module) => {
  var KEYWORDS = [
    "multipleOf",
    "maximum",
    "exclusiveMaximum",
    "minimum",
    "exclusiveMinimum",
    "maxLength",
    "minLength",
    "pattern",
    "additionalItems",
    "maxItems",
    "minItems",
    "uniqueItems",
    "maxProperties",
    "minProperties",
    "required",
    "additionalProperties",
    "enum",
    "format",
    "const"
  ];
  module.exports = function(metaSchema, keywordsJsonPointers) {
    for (var i = 0;i < keywordsJsonPointers.length; i++) {
      metaSchema = JSON.parse(JSON.stringify(metaSchema));
      var segments = keywordsJsonPointers[i].split("/");
      var keywords = metaSchema;
      var j;
      for (j = 1;j < segments.length; j++)
        keywords = keywords[segments[j]];
      for (j = 0;j < KEYWORDS.length; j++) {
        var key = KEYWORDS[j];
        var schema = keywords[key];
        if (schema) {
          keywords[key] = {
            anyOf: [
              schema,
              { $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#" }
            ]
          };
        }
      }
    }
    return metaSchema;
  };
});

// node_modules/ajv/lib/compile/async.js
var require_async = __commonJS((exports, module) => {
  var MissingRefError = require_error_classes().MissingRef;
  module.exports = compileAsync;
  function compileAsync(schema, meta, callback) {
    var self = this;
    if (typeof this._opts.loadSchema != "function")
      throw new Error("options.loadSchema should be a function");
    if (typeof meta == "function") {
      callback = meta;
      meta = undefined;
    }
    var p = loadMetaSchemaOf(schema).then(function() {
      var schemaObj = self._addSchema(schema, undefined, meta);
      return schemaObj.validate || _compileAsync(schemaObj);
    });
    if (callback) {
      p.then(function(v) {
        callback(null, v);
      }, callback);
    }
    return p;
    function loadMetaSchemaOf(sch) {
      var $schema = sch.$schema;
      return $schema && !self.getSchema($schema) ? compileAsync.call(self, { $ref: $schema }, true) : Promise.resolve();
    }
    function _compileAsync(schemaObj) {
      try {
        return self._compile(schemaObj);
      } catch (e) {
        if (e instanceof MissingRefError)
          return loadMissingSchema(e);
        throw e;
      }
      function loadMissingSchema(e) {
        var ref = e.missingSchema;
        if (added(ref))
          throw new Error("Schema " + ref + " is loaded but " + e.missingRef + " cannot be resolved");
        var schemaPromise = self._loadingSchemas[ref];
        if (!schemaPromise) {
          schemaPromise = self._loadingSchemas[ref] = self._opts.loadSchema(ref);
          schemaPromise.then(removePromise, removePromise);
        }
        return schemaPromise.then(function(sch) {
          if (!added(ref)) {
            return loadMetaSchemaOf(sch).then(function() {
              if (!added(ref))
                self.addSchema(sch, ref, undefined, meta);
            });
          }
        }).then(function() {
          return _compileAsync(schemaObj);
        });
        function removePromise() {
          delete self._loadingSchemas[ref];
        }
        function added(ref2) {
          return self._refs[ref2] || self._schemas[ref2];
        }
      }
    }
  }
});

// node_modules/ajv/lib/dotjs/custom.js
var require_custom = __commonJS((exports, module) => {
  module.exports = function generate_custom(it, $keyword, $ruleType) {
    var out = " ";
    var $lvl = it.level;
    var $dataLvl = it.dataLevel;
    var $schema = it.schema[$keyword];
    var $schemaPath = it.schemaPath + it.util.getProperty($keyword);
    var $errSchemaPath = it.errSchemaPath + "/" + $keyword;
    var $breakOnError = !it.opts.allErrors;
    var $errorKeyword;
    var $data = "data" + ($dataLvl || "");
    var $valid = "valid" + $lvl;
    var $errs = "errs__" + $lvl;
    var $isData = it.opts.$data && $schema && $schema.$data, $schemaValue;
    if ($isData) {
      out += " var schema" + $lvl + " = " + it.util.getData($schema.$data, $dataLvl, it.dataPathArr) + "; ";
      $schemaValue = "schema" + $lvl;
    } else {
      $schemaValue = $schema;
    }
    var $rule = this, $definition = "definition" + $lvl, $rDef = $rule.definition, $closingBraces = "";
    var $compile, $inline, $macro, $ruleValidate, $validateCode;
    if ($isData && $rDef.$data) {
      $validateCode = "keywordValidate" + $lvl;
      var $validateSchema = $rDef.validateSchema;
      out += " var " + $definition + " = RULES.custom['" + $keyword + "'].definition; var " + $validateCode + " = " + $definition + ".validate;";
    } else {
      $ruleValidate = it.useCustomRule($rule, $schema, it.schema, it);
      if (!$ruleValidate)
        return;
      $schemaValue = "validate.schema" + $schemaPath;
      $validateCode = $ruleValidate.code;
      $compile = $rDef.compile;
      $inline = $rDef.inline;
      $macro = $rDef.macro;
    }
    var $ruleErrs = $validateCode + ".errors", $i = "i" + $lvl, $ruleErr = "ruleErr" + $lvl, $asyncKeyword = $rDef.async;
    if ($asyncKeyword && !it.async)
      throw new Error("async keyword in sync schema");
    if (!($inline || $macro)) {
      out += "" + $ruleErrs + " = null;";
    }
    out += "var " + $errs + " = errors;var " + $valid + ";";
    if ($isData && $rDef.$data) {
      $closingBraces += "}";
      out += " if (" + $schemaValue + " === undefined) { " + $valid + " = true; } else { ";
      if ($validateSchema) {
        $closingBraces += "}";
        out += " " + $valid + " = " + $definition + ".validateSchema(" + $schemaValue + "); if (" + $valid + ") { ";
      }
    }
    if ($inline) {
      if ($rDef.statements) {
        out += " " + $ruleValidate.validate + " ";
      } else {
        out += " " + $valid + " = " + $ruleValidate.validate + "; ";
      }
    } else if ($macro) {
      var $it = it.util.copy(it);
      var $closingBraces = "";
      $it.level++;
      var $nextValid = "valid" + $it.level;
      $it.schema = $ruleValidate.validate;
      $it.schemaPath = "";
      var $wasComposite = it.compositeRule;
      it.compositeRule = $it.compositeRule = true;
      var $code = it.validate($it).replace(/validate\.schema/g, $validateCode);
      it.compositeRule = $it.compositeRule = $wasComposite;
      out += " " + $code;
    } else {
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      out += "  " + $validateCode + ".call( ";
      if (it.opts.passContext) {
        out += "this";
      } else {
        out += "self";
      }
      if ($compile || $rDef.schema === false) {
        out += " , " + $data + " ";
      } else {
        out += " , " + $schemaValue + " , " + $data + " , validate.schema" + it.schemaPath + " ";
      }
      out += " , (dataPath || '')";
      if (it.errorPath != '""') {
        out += " + " + it.errorPath;
      }
      var $parentData = $dataLvl ? "data" + ($dataLvl - 1 || "") : "parentData", $parentDataProperty = $dataLvl ? it.dataPathArr[$dataLvl] : "parentDataProperty";
      out += " , " + $parentData + " , " + $parentDataProperty + " , rootData )  ";
      var def_callRuleValidate = out;
      out = $$outStack.pop();
      if ($rDef.errors === false) {
        out += " " + $valid + " = ";
        if ($asyncKeyword) {
          out += "await ";
        }
        out += "" + def_callRuleValidate + "; ";
      } else {
        if ($asyncKeyword) {
          $ruleErrs = "customErrors" + $lvl;
          out += " var " + $ruleErrs + " = null; try { " + $valid + " = await " + def_callRuleValidate + "; } catch (e) { " + $valid + " = false; if (e instanceof ValidationError) " + $ruleErrs + " = e.errors; else throw e; } ";
        } else {
          out += " " + $ruleErrs + " = null; " + $valid + " = " + def_callRuleValidate + "; ";
        }
      }
    }
    if ($rDef.modifying) {
      out += " if (" + $parentData + ") " + $data + " = " + $parentData + "[" + $parentDataProperty + "];";
    }
    out += "" + $closingBraces;
    if ($rDef.valid) {
      if ($breakOnError) {
        out += " if (true) { ";
      }
    } else {
      out += " if ( ";
      if ($rDef.valid === undefined) {
        out += " !";
        if ($macro) {
          out += "" + $nextValid;
        } else {
          out += "" + $valid;
        }
      } else {
        out += " " + !$rDef.valid + " ";
      }
      out += ") { ";
      $errorKeyword = $rule.keyword;
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      var $$outStack = $$outStack || [];
      $$outStack.push(out);
      out = "";
      if (it.createErrors !== false) {
        out += " { keyword: '" + ($errorKeyword || "custom") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { keyword: '" + $rule.keyword + "' } ";
        if (it.opts.messages !== false) {
          out += ` , message: 'should pass "` + $rule.keyword + `" keyword validation' `;
        }
        if (it.opts.verbose) {
          out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
        }
        out += " } ";
      } else {
        out += " {} ";
      }
      var __err = out;
      out = $$outStack.pop();
      if (!it.compositeRule && $breakOnError) {
        if (it.async) {
          out += " throw new ValidationError([" + __err + "]); ";
        } else {
          out += " validate.errors = [" + __err + "]; return false; ";
        }
      } else {
        out += " var err = " + __err + ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
      }
      var def_customError = out;
      out = $$outStack.pop();
      if ($inline) {
        if ($rDef.errors) {
          if ($rDef.errors != "full") {
            out += "  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + "; if (" + $ruleErr + ".schemaPath === undefined) { " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '"; } ';
            if (it.opts.verbose) {
              out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
            }
            out += " } ";
          }
        } else {
          if ($rDef.errors === false) {
            out += " " + def_customError + " ";
          } else {
            out += " if (" + $errs + " == errors) { " + def_customError + " } else {  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + "; if (" + $ruleErr + ".schemaPath === undefined) { " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '"; } ';
            if (it.opts.verbose) {
              out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
            }
            out += " } } ";
          }
        }
      } else if ($macro) {
        out += "   var err =   ";
        if (it.createErrors !== false) {
          out += " { keyword: '" + ($errorKeyword || "custom") + "' , dataPath: (dataPath || '') + " + it.errorPath + " , schemaPath: " + it.util.toQuotedString($errSchemaPath) + " , params: { keyword: '" + $rule.keyword + "' } ";
          if (it.opts.messages !== false) {
            out += ` , message: 'should pass "` + $rule.keyword + `" keyword validation' `;
          }
          if (it.opts.verbose) {
            out += " , schema: validate.schema" + $schemaPath + " , parentSchema: validate.schema" + it.schemaPath + " , data: " + $data + " ";
          }
          out += " } ";
        } else {
          out += " {} ";
        }
        out += ";  if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++; ";
        if (!it.compositeRule && $breakOnError) {
          if (it.async) {
            out += " throw new ValidationError(vErrors); ";
          } else {
            out += " validate.errors = vErrors; return false; ";
          }
        }
      } else {
        if ($rDef.errors === false) {
          out += " " + def_customError + " ";
        } else {
          out += " if (Array.isArray(" + $ruleErrs + ")) { if (vErrors === null) vErrors = " + $ruleErrs + "; else vErrors = vErrors.concat(" + $ruleErrs + "); errors = vErrors.length;  for (var " + $i + "=" + $errs + "; " + $i + "<errors; " + $i + "++) { var " + $ruleErr + " = vErrors[" + $i + "]; if (" + $ruleErr + ".dataPath === undefined) " + $ruleErr + ".dataPath = (dataPath || '') + " + it.errorPath + ";  " + $ruleErr + '.schemaPath = "' + $errSchemaPath + '";  ';
          if (it.opts.verbose) {
            out += " " + $ruleErr + ".schema = " + $schemaValue + "; " + $ruleErr + ".data = " + $data + "; ";
          }
          out += " } } else { " + def_customError + " } ";
        }
      }
      out += " } ";
      if ($breakOnError) {
        out += " else { ";
      }
    }
    return out;
  };
});

// node_modules/ajv/lib/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS((exports, module) => {
  module.exports = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://json-schema.org/draft-07/schema#",
    title: "Core schema meta-schema",
    definitions: {
      schemaArray: {
        type: "array",
        minItems: 1,
        items: { $ref: "#" }
      },
      nonNegativeInteger: {
        type: "integer",
        minimum: 0
      },
      nonNegativeIntegerDefault0: {
        allOf: [
          { $ref: "#/definitions/nonNegativeInteger" },
          { default: 0 }
        ]
      },
      simpleTypes: {
        enum: [
          "array",
          "boolean",
          "integer",
          "null",
          "number",
          "object",
          "string"
        ]
      },
      stringArray: {
        type: "array",
        items: { type: "string" },
        uniqueItems: true,
        default: []
      }
    },
    type: ["object", "boolean"],
    properties: {
      $id: {
        type: "string",
        format: "uri-reference"
      },
      $schema: {
        type: "string",
        format: "uri"
      },
      $ref: {
        type: "string",
        format: "uri-reference"
      },
      $comment: {
        type: "string"
      },
      title: {
        type: "string"
      },
      description: {
        type: "string"
      },
      default: true,
      readOnly: {
        type: "boolean",
        default: false
      },
      examples: {
        type: "array",
        items: true
      },
      multipleOf: {
        type: "number",
        exclusiveMinimum: 0
      },
      maximum: {
        type: "number"
      },
      exclusiveMaximum: {
        type: "number"
      },
      minimum: {
        type: "number"
      },
      exclusiveMinimum: {
        type: "number"
      },
      maxLength: { $ref: "#/definitions/nonNegativeInteger" },
      minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      pattern: {
        type: "string",
        format: "regex"
      },
      additionalItems: { $ref: "#" },
      items: {
        anyOf: [
          { $ref: "#" },
          { $ref: "#/definitions/schemaArray" }
        ],
        default: true
      },
      maxItems: { $ref: "#/definitions/nonNegativeInteger" },
      minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      uniqueItems: {
        type: "boolean",
        default: false
      },
      contains: { $ref: "#" },
      maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
      minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      required: { $ref: "#/definitions/stringArray" },
      additionalProperties: { $ref: "#" },
      definitions: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {}
      },
      properties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {}
      },
      patternProperties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        propertyNames: { format: "regex" },
        default: {}
      },
      dependencies: {
        type: "object",
        additionalProperties: {
          anyOf: [
            { $ref: "#" },
            { $ref: "#/definitions/stringArray" }
          ]
        }
      },
      propertyNames: { $ref: "#" },
      const: true,
      enum: {
        type: "array",
        items: true,
        minItems: 1,
        uniqueItems: true
      },
      type: {
        anyOf: [
          { $ref: "#/definitions/simpleTypes" },
          {
            type: "array",
            items: { $ref: "#/definitions/simpleTypes" },
            minItems: 1,
            uniqueItems: true
          }
        ]
      },
      format: { type: "string" },
      contentMediaType: { type: "string" },
      contentEncoding: { type: "string" },
      if: { $ref: "#" },
      then: { $ref: "#" },
      else: { $ref: "#" },
      allOf: { $ref: "#/definitions/schemaArray" },
      anyOf: { $ref: "#/definitions/schemaArray" },
      oneOf: { $ref: "#/definitions/schemaArray" },
      not: { $ref: "#" }
    },
    default: true
  };
});

// node_modules/ajv/lib/definition_schema.js
var require_definition_schema = __commonJS((exports, module) => {
  var metaSchema = require_json_schema_draft_07();
  module.exports = {
    $id: "https://github.com/ajv-validator/ajv/blob/master/lib/definition_schema.js",
    definitions: {
      simpleTypes: metaSchema.definitions.simpleTypes
    },
    type: "object",
    dependencies: {
      schema: ["validate"],
      $data: ["validate"],
      statements: ["inline"],
      valid: { not: { required: ["macro"] } }
    },
    properties: {
      type: metaSchema.properties.type,
      schema: { type: "boolean" },
      statements: { type: "boolean" },
      dependencies: {
        type: "array",
        items: { type: "string" }
      },
      metaSchema: { type: "object" },
      modifying: { type: "boolean" },
      valid: { type: "boolean" },
      $data: { type: "boolean" },
      async: { type: "boolean" },
      errors: {
        anyOf: [
          { type: "boolean" },
          { const: "full" }
        ]
      }
    }
  };
});

// node_modules/ajv/lib/keyword.js
var require_keyword = __commonJS((exports, module) => {
  var IDENTIFIER = /^[a-z_$][a-z0-9_$-]*$/i;
  var customRuleCode = require_custom();
  var definitionSchema = require_definition_schema();
  module.exports = {
    add: addKeyword,
    get: getKeyword,
    remove: removeKeyword,
    validate: validateKeyword
  };
  function addKeyword(keyword, definition) {
    var RULES = this.RULES;
    if (RULES.keywords[keyword])
      throw new Error("Keyword " + keyword + " is already defined");
    if (!IDENTIFIER.test(keyword))
      throw new Error("Keyword " + keyword + " is not a valid identifier");
    if (definition) {
      this.validateKeyword(definition, true);
      var dataType = definition.type;
      if (Array.isArray(dataType)) {
        for (var i = 0;i < dataType.length; i++)
          _addRule(keyword, dataType[i], definition);
      } else {
        _addRule(keyword, dataType, definition);
      }
      var metaSchema = definition.metaSchema;
      if (metaSchema) {
        if (definition.$data && this._opts.$data) {
          metaSchema = {
            anyOf: [
              metaSchema,
              { $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#" }
            ]
          };
        }
        definition.validateSchema = this.compile(metaSchema, true);
      }
    }
    RULES.keywords[keyword] = RULES.all[keyword] = true;
    function _addRule(keyword2, dataType2, definition2) {
      var ruleGroup;
      for (var i2 = 0;i2 < RULES.length; i2++) {
        var rg = RULES[i2];
        if (rg.type == dataType2) {
          ruleGroup = rg;
          break;
        }
      }
      if (!ruleGroup) {
        ruleGroup = { type: dataType2, rules: [] };
        RULES.push(ruleGroup);
      }
      var rule = {
        keyword: keyword2,
        definition: definition2,
        custom: true,
        code: customRuleCode,
        implements: definition2.implements
      };
      ruleGroup.rules.push(rule);
      RULES.custom[keyword2] = rule;
    }
    return this;
  }
  function getKeyword(keyword) {
    var rule = this.RULES.custom[keyword];
    return rule ? rule.definition : this.RULES.keywords[keyword] || false;
  }
  function removeKeyword(keyword) {
    var RULES = this.RULES;
    delete RULES.keywords[keyword];
    delete RULES.all[keyword];
    delete RULES.custom[keyword];
    for (var i = 0;i < RULES.length; i++) {
      var rules = RULES[i].rules;
      for (var j = 0;j < rules.length; j++) {
        if (rules[j].keyword == keyword) {
          rules.splice(j, 1);
          break;
        }
      }
    }
    return this;
  }
  function validateKeyword(definition, throwError) {
    validateKeyword.errors = null;
    var v = this._validateKeyword = this._validateKeyword || this.compile(definitionSchema, true);
    if (v(definition))
      return true;
    validateKeyword.errors = v.errors;
    if (throwError)
      throw new Error("custom keyword definition is invalid: " + this.errorsText(v.errors));
    else
      return false;
  }
});

// node_modules/ajv/lib/refs/data.json
var require_data2 = __commonJS((exports, module) => {
  module.exports = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
    description: "Meta-schema for $data reference (JSON Schema extension proposal)",
    type: "object",
    required: ["$data"],
    properties: {
      $data: {
        type: "string",
        anyOf: [
          { format: "relative-json-pointer" },
          { format: "json-pointer" }
        ]
      }
    },
    additionalProperties: false
  };
});

// node_modules/ajv/lib/ajv.js
var require_ajv = __commonJS((exports, module) => {
  var compileSchema = require_compile();
  var resolve = require_resolve();
  var Cache = require_cache();
  var SchemaObject = require_schema_obj();
  var stableStringify = require_fast_json_stable_stringify();
  var formats = require_formats();
  var rules = require_rules();
  var $dataMetaSchema = require_data();
  var util2 = require_util();
  module.exports = Ajv;
  Ajv.prototype.validate = validate;
  Ajv.prototype.compile = compile;
  Ajv.prototype.addSchema = addSchema;
  Ajv.prototype.addMetaSchema = addMetaSchema;
  Ajv.prototype.validateSchema = validateSchema;
  Ajv.prototype.getSchema = getSchema;
  Ajv.prototype.removeSchema = removeSchema;
  Ajv.prototype.addFormat = addFormat;
  Ajv.prototype.errorsText = errorsText;
  Ajv.prototype._addSchema = _addSchema;
  Ajv.prototype._compile = _compile;
  Ajv.prototype.compileAsync = require_async();
  var customKeyword = require_keyword();
  Ajv.prototype.addKeyword = customKeyword.add;
  Ajv.prototype.getKeyword = customKeyword.get;
  Ajv.prototype.removeKeyword = customKeyword.remove;
  Ajv.prototype.validateKeyword = customKeyword.validate;
  var errorClasses = require_error_classes();
  Ajv.ValidationError = errorClasses.Validation;
  Ajv.MissingRefError = errorClasses.MissingRef;
  Ajv.$dataMetaSchema = $dataMetaSchema;
  var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
  var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes", "strictDefaults"];
  var META_SUPPORT_DATA = ["/properties"];
  function Ajv(opts) {
    if (!(this instanceof Ajv))
      return new Ajv(opts);
    opts = this._opts = util2.copy(opts) || {};
    setLogger(this);
    this._schemas = {};
    this._refs = {};
    this._fragments = {};
    this._formats = formats(opts.format);
    this._cache = opts.cache || new Cache;
    this._loadingSchemas = {};
    this._compilations = [];
    this.RULES = rules();
    this._getId = chooseGetId(opts);
    opts.loopRequired = opts.loopRequired || Infinity;
    if (opts.errorDataPath == "property")
      opts._errorDataPathProperty = true;
    if (opts.serialize === undefined)
      opts.serialize = stableStringify;
    this._metaOpts = getMetaSchemaOptions(this);
    if (opts.formats)
      addInitialFormats(this);
    if (opts.keywords)
      addInitialKeywords(this);
    addDefaultMetaSchema(this);
    if (typeof opts.meta == "object")
      this.addMetaSchema(opts.meta);
    if (opts.nullable)
      this.addKeyword("nullable", { metaSchema: { type: "boolean" } });
    addInitialSchemas(this);
  }
  function validate(schemaKeyRef, data) {
    var v;
    if (typeof schemaKeyRef == "string") {
      v = this.getSchema(schemaKeyRef);
      if (!v)
        throw new Error('no schema with key or ref "' + schemaKeyRef + '"');
    } else {
      var schemaObj = this._addSchema(schemaKeyRef);
      v = schemaObj.validate || this._compile(schemaObj);
    }
    var valid = v(data);
    if (v.$async !== true)
      this.errors = v.errors;
    return valid;
  }
  function compile(schema, _meta) {
    var schemaObj = this._addSchema(schema, undefined, _meta);
    return schemaObj.validate || this._compile(schemaObj);
  }
  function addSchema(schema, key, _skipValidation, _meta) {
    if (Array.isArray(schema)) {
      for (var i = 0;i < schema.length; i++)
        this.addSchema(schema[i], undefined, _skipValidation, _meta);
      return this;
    }
    var id = this._getId(schema);
    if (id !== undefined && typeof id != "string")
      throw new Error("schema id must be string");
    key = resolve.normalizeId(key || id);
    checkUnique(this, key);
    this._schemas[key] = this._addSchema(schema, _skipValidation, _meta, true);
    return this;
  }
  function addMetaSchema(schema, key, skipValidation) {
    this.addSchema(schema, key, skipValidation, true);
    return this;
  }
  function validateSchema(schema, throwOrLogError) {
    var $schema = schema.$schema;
    if ($schema !== undefined && typeof $schema != "string")
      throw new Error("$schema must be a string");
    $schema = $schema || this._opts.defaultMeta || defaultMeta(this);
    if (!$schema) {
      this.logger.warn("meta-schema not available");
      this.errors = null;
      return true;
    }
    var valid = this.validate($schema, schema);
    if (!valid && throwOrLogError) {
      var message = "schema is invalid: " + this.errorsText();
      if (this._opts.validateSchema == "log")
        this.logger.error(message);
      else
        throw new Error(message);
    }
    return valid;
  }
  function defaultMeta(self) {
    var meta = self._opts.meta;
    self._opts.defaultMeta = typeof meta == "object" ? self._getId(meta) || meta : self.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined;
    return self._opts.defaultMeta;
  }
  function getSchema(keyRef) {
    var schemaObj = _getSchemaObj(this, keyRef);
    switch (typeof schemaObj) {
      case "object":
        return schemaObj.validate || this._compile(schemaObj);
      case "string":
        return this.getSchema(schemaObj);
      case "undefined":
        return _getSchemaFragment(this, keyRef);
    }
  }
  function _getSchemaFragment(self, ref) {
    var res = resolve.schema.call(self, { schema: {} }, ref);
    if (res) {
      var { schema, root, baseId } = res;
      var v = compileSchema.call(self, schema, root, undefined, baseId);
      self._fragments[ref] = new SchemaObject({
        ref,
        fragment: true,
        schema,
        root,
        baseId,
        validate: v
      });
      return v;
    }
  }
  function _getSchemaObj(self, keyRef) {
    keyRef = resolve.normalizeId(keyRef);
    return self._schemas[keyRef] || self._refs[keyRef] || self._fragments[keyRef];
  }
  function removeSchema(schemaKeyRef) {
    if (schemaKeyRef instanceof RegExp) {
      _removeAllSchemas(this, this._schemas, schemaKeyRef);
      _removeAllSchemas(this, this._refs, schemaKeyRef);
      return this;
    }
    switch (typeof schemaKeyRef) {
      case "undefined":
        _removeAllSchemas(this, this._schemas);
        _removeAllSchemas(this, this._refs);
        this._cache.clear();
        return this;
      case "string":
        var schemaObj = _getSchemaObj(this, schemaKeyRef);
        if (schemaObj)
          this._cache.del(schemaObj.cacheKey);
        delete this._schemas[schemaKeyRef];
        delete this._refs[schemaKeyRef];
        return this;
      case "object":
        var serialize = this._opts.serialize;
        var cacheKey = serialize ? serialize(schemaKeyRef) : schemaKeyRef;
        this._cache.del(cacheKey);
        var id = this._getId(schemaKeyRef);
        if (id) {
          id = resolve.normalizeId(id);
          delete this._schemas[id];
          delete this._refs[id];
        }
    }
    return this;
  }
  function _removeAllSchemas(self, schemas, regex) {
    for (var keyRef in schemas) {
      var schemaObj = schemas[keyRef];
      if (!schemaObj.meta && (!regex || regex.test(keyRef))) {
        self._cache.del(schemaObj.cacheKey);
        delete schemas[keyRef];
      }
    }
  }
  function _addSchema(schema, skipValidation, meta, shouldAddSchema) {
    if (typeof schema != "object" && typeof schema != "boolean")
      throw new Error("schema should be object or boolean");
    var serialize = this._opts.serialize;
    var cacheKey = serialize ? serialize(schema) : schema;
    var cached = this._cache.get(cacheKey);
    if (cached)
      return cached;
    shouldAddSchema = shouldAddSchema || this._opts.addUsedSchema !== false;
    var id = resolve.normalizeId(this._getId(schema));
    if (id && shouldAddSchema)
      checkUnique(this, id);
    var willValidate = this._opts.validateSchema !== false && !skipValidation;
    var recursiveMeta;
    if (willValidate && !(recursiveMeta = id && id == resolve.normalizeId(schema.$schema)))
      this.validateSchema(schema, true);
    var localRefs = resolve.ids.call(this, schema);
    var schemaObj = new SchemaObject({
      id,
      schema,
      localRefs,
      cacheKey,
      meta
    });
    if (id[0] != "#" && shouldAddSchema)
      this._refs[id] = schemaObj;
    this._cache.put(cacheKey, schemaObj);
    if (willValidate && recursiveMeta)
      this.validateSchema(schema, true);
    return schemaObj;
  }
  function _compile(schemaObj, root) {
    if (schemaObj.compiling) {
      schemaObj.validate = callValidate;
      callValidate.schema = schemaObj.schema;
      callValidate.errors = null;
      callValidate.root = root ? root : callValidate;
      if (schemaObj.schema.$async === true)
        callValidate.$async = true;
      return callValidate;
    }
    schemaObj.compiling = true;
    var currentOpts;
    if (schemaObj.meta) {
      currentOpts = this._opts;
      this._opts = this._metaOpts;
    }
    var v;
    try {
      v = compileSchema.call(this, schemaObj.schema, root, schemaObj.localRefs);
    } catch (e) {
      delete schemaObj.validate;
      throw e;
    } finally {
      schemaObj.compiling = false;
      if (schemaObj.meta)
        this._opts = currentOpts;
    }
    schemaObj.validate = v;
    schemaObj.refs = v.refs;
    schemaObj.refVal = v.refVal;
    schemaObj.root = v.root;
    return v;
    function callValidate() {
      var _validate = schemaObj.validate;
      var result = _validate.apply(this, arguments);
      callValidate.errors = _validate.errors;
      return result;
    }
  }
  function chooseGetId(opts) {
    switch (opts.schemaId) {
      case "auto":
        return _get$IdOrId;
      case "id":
        return _getId;
      default:
        return _get$Id;
    }
  }
  function _getId(schema) {
    if (schema.$id)
      this.logger.warn("schema $id ignored", schema.$id);
    return schema.id;
  }
  function _get$Id(schema) {
    if (schema.id)
      this.logger.warn("schema id ignored", schema.id);
    return schema.$id;
  }
  function _get$IdOrId(schema) {
    if (schema.$id && schema.id && schema.$id != schema.id)
      throw new Error("schema $id is different from id");
    return schema.$id || schema.id;
  }
  function errorsText(errors, options) {
    errors = errors || this.errors;
    if (!errors)
      return "No errors";
    options = options || {};
    var separator = options.separator === undefined ? ", " : options.separator;
    var dataVar = options.dataVar === undefined ? "data" : options.dataVar;
    var text = "";
    for (var i = 0;i < errors.length; i++) {
      var e = errors[i];
      if (e)
        text += dataVar + e.dataPath + " " + e.message + separator;
    }
    return text.slice(0, -separator.length);
  }
  function addFormat(name, format) {
    if (typeof format == "string")
      format = new RegExp(format);
    this._formats[name] = format;
    return this;
  }
  function addDefaultMetaSchema(self) {
    var $dataSchema;
    if (self._opts.$data) {
      $dataSchema = require_data2();
      self.addMetaSchema($dataSchema, $dataSchema.$id, true);
    }
    if (self._opts.meta === false)
      return;
    var metaSchema = require_json_schema_draft_07();
    if (self._opts.$data)
      metaSchema = $dataMetaSchema(metaSchema, META_SUPPORT_DATA);
    self.addMetaSchema(metaSchema, META_SCHEMA_ID, true);
    self._refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
  }
  function addInitialSchemas(self) {
    var optsSchemas = self._opts.schemas;
    if (!optsSchemas)
      return;
    if (Array.isArray(optsSchemas))
      self.addSchema(optsSchemas);
    else
      for (var key in optsSchemas)
        self.addSchema(optsSchemas[key], key);
  }
  function addInitialFormats(self) {
    for (var name in self._opts.formats) {
      var format = self._opts.formats[name];
      self.addFormat(name, format);
    }
  }
  function addInitialKeywords(self) {
    for (var name in self._opts.keywords) {
      var keyword = self._opts.keywords[name];
      self.addKeyword(name, keyword);
    }
  }
  function checkUnique(self, id) {
    if (self._schemas[id] || self._refs[id])
      throw new Error('schema with key or id "' + id + '" already exists');
  }
  function getMetaSchemaOptions(self) {
    var metaOpts = util2.copy(self._opts);
    for (var i = 0;i < META_IGNORE_OPTIONS.length; i++)
      delete metaOpts[META_IGNORE_OPTIONS[i]];
    return metaOpts;
  }
  function setLogger(self) {
    var logger = self._opts.logger;
    if (logger === false) {
      self.logger = { log: noop, warn: noop, error: noop };
    } else {
      if (logger === undefined)
        logger = console;
      if (!(typeof logger == "object" && logger.log && logger.warn && logger.error))
        throw new Error("logger must implement log, warn and error methods");
      self.logger = logger;
    }
  }
  function noop() {}
});

// node_modules/@modelcontextprotocol/sdk/node_modules/zod/lib/index.mjs
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {}
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error;
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== undefined) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === errorMap ? undefined : errorMap
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}

class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === undefined ? undefined : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache;
var _ZodNativeEnum_cache;

class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== undefined ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== undefined ? message : required_error) !== null && _a !== undefined ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== undefined ? message : invalid_type_error) !== null && _b !== undefined ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus,
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === undefined ? undefined : params.async) !== null && _a !== undefined ? _a : false,
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    var _a, _b;
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if ((_b = (_a = err === null || err === undefined ? undefined : err.message) === null || _a === undefined ? undefined : _a.toLowerCase()) === null || _b === undefined ? undefined : _b.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap,
        async: true
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if (!decoded.typ || !decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch (_a) {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}

class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a, _b;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === undefined ? undefined : options.precision) === "undefined" ? null : options === null || options === undefined ? undefined : options.precision,
      offset: (_a = options === null || options === undefined ? undefined : options.offset) !== null && _a !== undefined ? _a : false,
      local: (_b = options === null || options === undefined ? undefined : options.local) !== null && _b !== undefined ? _b : false,
      ...errorUtil.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options === null || options === undefined ? undefined : options.precision) === "undefined" ? null : options === null || options === undefined ? undefined : options.precision,
      ...errorUtil.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === undefined ? undefined : options.position,
      ...errorUtil.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}

class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams(params)
  });
};

class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch (_a) {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams(params)
  });
};

class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams(params)
  });
};

class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};

class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};

class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};

class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};

class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};

class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};

class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};

class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};

class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : undefined,
          maximum: tooBig ? def.exactLength.value : undefined,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}

class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip")
        ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== undefined ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === undefined ? undefined : _b.call(_a, issue, ctx).message) !== null && _c !== undefined ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== undefined ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};

class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = undefined;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [undefined, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};

class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(discriminator, options, params) {
    const optionsMap = new Map;
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}

class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};

class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};

class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}

class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = new Map;
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = new Map;
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};

class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = new Set;
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};

class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}

class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};

class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}

class ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, undefined);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
_ZodEnum_cache = new WeakMap;
ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, undefined);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
_ZodNativeEnum_cache = new WeakMap;
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};

class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};

class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};

class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(undefined);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};

class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};

class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};

class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};

class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");

class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}

class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}

class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          var _a2, _b2;
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = (_b2 = (_a2 = params.fatal) !== null && _a2 !== undefined ? _a2 : fatal) !== null && _b2 !== undefined ? _b2 : true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = (_b = (_a = params.fatal) !== null && _a !== undefined ? _a : fatal) !== null && _b !== undefined ? _b : true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  enum: enumType,
  function: functionType,
  instanceof: instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  null: nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  undefined: undefinedType,
  union: unionType,
  unknown: unknownType,
  void: voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/types.js
var LATEST_PROTOCOL_VERSION = "2025-06-18";
var SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2025-03-26",
  "2024-11-05",
  "2024-10-07"
];
var JSONRPC_VERSION = "2.0";
var ProgressTokenSchema = z.union([z.string(), z.number().int()]);
var CursorSchema = z.string();
var RequestMetaSchema = z.object({
  progressToken: z.optional(ProgressTokenSchema)
}).passthrough();
var BaseRequestParamsSchema = z.object({
  _meta: z.optional(RequestMetaSchema)
}).passthrough();
var RequestSchema = z.object({
  method: z.string(),
  params: z.optional(BaseRequestParamsSchema)
});
var BaseNotificationParamsSchema = z.object({
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var NotificationSchema = z.object({
  method: z.string(),
  params: z.optional(BaseNotificationParamsSchema)
});
var ResultSchema = z.object({
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var RequestIdSchema = z.union([z.string(), z.number().int()]);
var JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: RequestIdSchema
}).merge(RequestSchema).strict();
var isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
var JSONRPCNotificationSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION)
}).merge(NotificationSchema).strict();
var isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
var JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: RequestIdSchema,
  result: ResultSchema
}).strict();
var isJSONRPCResponse = (value) => JSONRPCResponseSchema.safeParse(value).success;
var ErrorCode;
(function(ErrorCode2) {
  ErrorCode2[ErrorCode2["ConnectionClosed"] = -32000] = "ConnectionClosed";
  ErrorCode2[ErrorCode2["RequestTimeout"] = -32001] = "RequestTimeout";
  ErrorCode2[ErrorCode2["ParseError"] = -32700] = "ParseError";
  ErrorCode2[ErrorCode2["InvalidRequest"] = -32600] = "InvalidRequest";
  ErrorCode2[ErrorCode2["MethodNotFound"] = -32601] = "MethodNotFound";
  ErrorCode2[ErrorCode2["InvalidParams"] = -32602] = "InvalidParams";
  ErrorCode2[ErrorCode2["InternalError"] = -32603] = "InternalError";
})(ErrorCode || (ErrorCode = {}));
var JSONRPCErrorSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: RequestIdSchema,
  error: z.object({
    code: z.number().int(),
    message: z.string(),
    data: z.optional(z.unknown())
  })
}).strict();
var isJSONRPCError = (value) => JSONRPCErrorSchema.safeParse(value).success;
var JSONRPCMessageSchema = z.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema
]);
var EmptyResultSchema = ResultSchema.strict();
var CancelledNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/cancelled"),
  params: BaseNotificationParamsSchema.extend({
    requestId: RequestIdSchema,
    reason: z.string().optional()
  })
});
var BaseMetadataSchema = z.object({
  name: z.string(),
  title: z.optional(z.string())
}).passthrough();
var ImplementationSchema = BaseMetadataSchema.extend({
  version: z.string()
});
var ClientCapabilitiesSchema = z.object({
  experimental: z.optional(z.object({}).passthrough()),
  sampling: z.optional(z.object({}).passthrough()),
  elicitation: z.optional(z.object({}).passthrough()),
  roots: z.optional(z.object({
    listChanged: z.optional(z.boolean())
  }).passthrough())
}).passthrough();
var InitializeRequestSchema = RequestSchema.extend({
  method: z.literal("initialize"),
  params: BaseRequestParamsSchema.extend({
    protocolVersion: z.string(),
    capabilities: ClientCapabilitiesSchema,
    clientInfo: ImplementationSchema
  })
});
var ServerCapabilitiesSchema = z.object({
  experimental: z.optional(z.object({}).passthrough()),
  logging: z.optional(z.object({}).passthrough()),
  completions: z.optional(z.object({}).passthrough()),
  prompts: z.optional(z.object({
    listChanged: z.optional(z.boolean())
  }).passthrough()),
  resources: z.optional(z.object({
    subscribe: z.optional(z.boolean()),
    listChanged: z.optional(z.boolean())
  }).passthrough()),
  tools: z.optional(z.object({
    listChanged: z.optional(z.boolean())
  }).passthrough())
}).passthrough();
var InitializeResultSchema = ResultSchema.extend({
  protocolVersion: z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ImplementationSchema,
  instructions: z.optional(z.string())
});
var InitializedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/initialized")
});
var PingRequestSchema = RequestSchema.extend({
  method: z.literal("ping")
});
var ProgressSchema = z.object({
  progress: z.number(),
  total: z.optional(z.number()),
  message: z.optional(z.string())
}).passthrough();
var ProgressNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/progress"),
  params: BaseNotificationParamsSchema.merge(ProgressSchema).extend({
    progressToken: ProgressTokenSchema
  })
});
var PaginatedRequestSchema = RequestSchema.extend({
  params: BaseRequestParamsSchema.extend({
    cursor: z.optional(CursorSchema)
  }).optional()
});
var PaginatedResultSchema = ResultSchema.extend({
  nextCursor: z.optional(CursorSchema)
});
var ResourceContentsSchema = z.object({
  uri: z.string(),
  mimeType: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var TextResourceContentsSchema = ResourceContentsSchema.extend({
  text: z.string()
});
var BlobResourceContentsSchema = ResourceContentsSchema.extend({
  blob: z.string().base64()
});
var ResourceSchema = BaseMetadataSchema.extend({
  uri: z.string(),
  description: z.optional(z.string()),
  mimeType: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough())
});
var ResourceTemplateSchema = BaseMetadataSchema.extend({
  uriTemplate: z.string(),
  description: z.optional(z.string()),
  mimeType: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough())
});
var ListResourcesRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("resources/list")
});
var ListResourcesResultSchema = PaginatedResultSchema.extend({
  resources: z.array(ResourceSchema)
});
var ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("resources/templates/list")
});
var ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
  resourceTemplates: z.array(ResourceTemplateSchema)
});
var ReadResourceRequestSchema = RequestSchema.extend({
  method: z.literal("resources/read"),
  params: BaseRequestParamsSchema.extend({
    uri: z.string()
  })
});
var ReadResourceResultSchema = ResultSchema.extend({
  contents: z.array(z.union([TextResourceContentsSchema, BlobResourceContentsSchema]))
});
var ResourceListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/resources/list_changed")
});
var SubscribeRequestSchema = RequestSchema.extend({
  method: z.literal("resources/subscribe"),
  params: BaseRequestParamsSchema.extend({
    uri: z.string()
  })
});
var UnsubscribeRequestSchema = RequestSchema.extend({
  method: z.literal("resources/unsubscribe"),
  params: BaseRequestParamsSchema.extend({
    uri: z.string()
  })
});
var ResourceUpdatedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/resources/updated"),
  params: BaseNotificationParamsSchema.extend({
    uri: z.string()
  })
});
var PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.optional(z.string()),
  required: z.optional(z.boolean())
}).passthrough();
var PromptSchema = BaseMetadataSchema.extend({
  description: z.optional(z.string()),
  arguments: z.optional(z.array(PromptArgumentSchema)),
  _meta: z.optional(z.object({}).passthrough())
});
var ListPromptsRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("prompts/list")
});
var ListPromptsResultSchema = PaginatedResultSchema.extend({
  prompts: z.array(PromptSchema)
});
var GetPromptRequestSchema = RequestSchema.extend({
  method: z.literal("prompts/get"),
  params: BaseRequestParamsSchema.extend({
    name: z.string(),
    arguments: z.optional(z.record(z.string()))
  })
});
var TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var ImageContentSchema = z.object({
  type: z.literal("image"),
  data: z.string().base64(),
  mimeType: z.string(),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var AudioContentSchema = z.object({
  type: z.literal("audio"),
  data: z.string().base64(),
  mimeType: z.string(),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var EmbeddedResourceSchema = z.object({
  type: z.literal("resource"),
  resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var ResourceLinkSchema = ResourceSchema.extend({
  type: z.literal("resource_link")
});
var ContentBlockSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkSchema,
  EmbeddedResourceSchema
]);
var PromptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: ContentBlockSchema
}).passthrough();
var GetPromptResultSchema = ResultSchema.extend({
  description: z.optional(z.string()),
  messages: z.array(PromptMessageSchema)
});
var PromptListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/prompts/list_changed")
});
var ToolAnnotationsSchema = z.object({
  title: z.optional(z.string()),
  readOnlyHint: z.optional(z.boolean()),
  destructiveHint: z.optional(z.boolean()),
  idempotentHint: z.optional(z.boolean()),
  openWorldHint: z.optional(z.boolean())
}).passthrough();
var ToolSchema = BaseMetadataSchema.extend({
  description: z.optional(z.string()),
  inputSchema: z.object({
    type: z.literal("object"),
    properties: z.optional(z.object({}).passthrough()),
    required: z.optional(z.array(z.string()))
  }).passthrough(),
  outputSchema: z.optional(z.object({
    type: z.literal("object"),
    properties: z.optional(z.object({}).passthrough()),
    required: z.optional(z.array(z.string()))
  }).passthrough()),
  annotations: z.optional(ToolAnnotationsSchema),
  _meta: z.optional(z.object({}).passthrough())
});
var ListToolsRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("tools/list")
});
var ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: z.array(ToolSchema)
});
var CallToolResultSchema = ResultSchema.extend({
  content: z.array(ContentBlockSchema).default([]),
  structuredContent: z.object({}).passthrough().optional(),
  isError: z.optional(z.boolean())
});
var CompatibilityCallToolResultSchema = CallToolResultSchema.or(ResultSchema.extend({
  toolResult: z.unknown()
}));
var CallToolRequestSchema = RequestSchema.extend({
  method: z.literal("tools/call"),
  params: BaseRequestParamsSchema.extend({
    name: z.string(),
    arguments: z.optional(z.record(z.unknown()))
  })
});
var ToolListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/tools/list_changed")
});
var LoggingLevelSchema = z.enum([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency"
]);
var SetLevelRequestSchema = RequestSchema.extend({
  method: z.literal("logging/setLevel"),
  params: BaseRequestParamsSchema.extend({
    level: LoggingLevelSchema
  })
});
var LoggingMessageNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/message"),
  params: BaseNotificationParamsSchema.extend({
    level: LoggingLevelSchema,
    logger: z.optional(z.string()),
    data: z.unknown()
  })
});
var ModelHintSchema = z.object({
  name: z.string().optional()
}).passthrough();
var ModelPreferencesSchema = z.object({
  hints: z.optional(z.array(ModelHintSchema)),
  costPriority: z.optional(z.number().min(0).max(1)),
  speedPriority: z.optional(z.number().min(0).max(1)),
  intelligencePriority: z.optional(z.number().min(0).max(1))
}).passthrough();
var SamplingMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([TextContentSchema, ImageContentSchema, AudioContentSchema])
}).passthrough();
var CreateMessageRequestSchema = RequestSchema.extend({
  method: z.literal("sampling/createMessage"),
  params: BaseRequestParamsSchema.extend({
    messages: z.array(SamplingMessageSchema),
    systemPrompt: z.optional(z.string()),
    includeContext: z.optional(z.enum(["none", "thisServer", "allServers"])),
    temperature: z.optional(z.number()),
    maxTokens: z.number().int(),
    stopSequences: z.optional(z.array(z.string())),
    metadata: z.optional(z.object({}).passthrough()),
    modelPreferences: z.optional(ModelPreferencesSchema)
  })
});
var CreateMessageResultSchema = ResultSchema.extend({
  model: z.string(),
  stopReason: z.optional(z.enum(["endTurn", "stopSequence", "maxTokens"]).or(z.string())),
  role: z.enum(["user", "assistant"]),
  content: z.discriminatedUnion("type", [
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema
  ])
});
var BooleanSchemaSchema = z.object({
  type: z.literal("boolean"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  default: z.optional(z.boolean())
}).passthrough();
var StringSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minLength: z.optional(z.number()),
  maxLength: z.optional(z.number()),
  format: z.optional(z.enum(["email", "uri", "date", "date-time"]))
}).passthrough();
var NumberSchemaSchema = z.object({
  type: z.enum(["number", "integer"]),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minimum: z.optional(z.number()),
  maximum: z.optional(z.number())
}).passthrough();
var EnumSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  enum: z.array(z.string()),
  enumNames: z.optional(z.array(z.string()))
}).passthrough();
var PrimitiveSchemaDefinitionSchema = z.union([
  BooleanSchemaSchema,
  StringSchemaSchema,
  NumberSchemaSchema,
  EnumSchemaSchema
]);
var ElicitRequestSchema = RequestSchema.extend({
  method: z.literal("elicitation/create"),
  params: BaseRequestParamsSchema.extend({
    message: z.string(),
    requestedSchema: z.object({
      type: z.literal("object"),
      properties: z.record(z.string(), PrimitiveSchemaDefinitionSchema),
      required: z.optional(z.array(z.string()))
    }).passthrough()
  })
});
var ElicitResultSchema = ResultSchema.extend({
  action: z.enum(["accept", "reject", "cancel"]),
  content: z.optional(z.record(z.string(), z.unknown()))
});
var ResourceTemplateReferenceSchema = z.object({
  type: z.literal("ref/resource"),
  uri: z.string()
}).passthrough();
var PromptReferenceSchema = z.object({
  type: z.literal("ref/prompt"),
  name: z.string()
}).passthrough();
var CompleteRequestSchema = RequestSchema.extend({
  method: z.literal("completion/complete"),
  params: BaseRequestParamsSchema.extend({
    ref: z.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
    argument: z.object({
      name: z.string(),
      value: z.string()
    }).passthrough(),
    context: z.optional(z.object({
      arguments: z.optional(z.record(z.string(), z.string()))
    }))
  })
});
var CompleteResultSchema = ResultSchema.extend({
  completion: z.object({
    values: z.array(z.string()).max(100),
    total: z.optional(z.number().int()),
    hasMore: z.optional(z.boolean())
  }).passthrough()
});
var RootSchema = z.object({
  uri: z.string().startsWith("file://"),
  name: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
var ListRootsRequestSchema = RequestSchema.extend({
  method: z.literal("roots/list")
});
var ListRootsResultSchema = ResultSchema.extend({
  roots: z.array(RootSchema)
});
var RootsListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/roots/list_changed")
});
var ClientRequestSchema = z.union([
  PingRequestSchema,
  InitializeRequestSchema,
  CompleteRequestSchema,
  SetLevelRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema
]);
var ClientNotificationSchema = z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  InitializedNotificationSchema,
  RootsListChangedNotificationSchema
]);
var ClientResultSchema = z.union([
  EmptyResultSchema,
  CreateMessageResultSchema,
  ElicitResultSchema,
  ListRootsResultSchema
]);
var ServerRequestSchema = z.union([
  PingRequestSchema,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  ListRootsRequestSchema
]);
var ServerNotificationSchema = z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
  PromptListChangedNotificationSchema
]);
var ServerResultSchema = z.union([
  EmptyResultSchema,
  InitializeResultSchema,
  CompleteResultSchema,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ReadResourceResultSchema,
  CallToolResultSchema,
  ListToolsResultSchema
]);

class McpError extends Error {
  constructor(code, message, data) {
    super(`MCP error ${code}: ${message}`);
    this.code = code;
    this.data = data;
    this.name = "McpError";
  }
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js
var DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;

class Protocol {
  constructor(_options) {
    this._options = _options;
    this._requestMessageId = 0;
    this._requestHandlers = new Map;
    this._requestHandlerAbortControllers = new Map;
    this._notificationHandlers = new Map;
    this._responseHandlers = new Map;
    this._progressHandlers = new Map;
    this._timeoutInfo = new Map;
    this.setNotificationHandler(CancelledNotificationSchema, (notification) => {
      const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
      controller === null || controller === undefined || controller.abort(notification.params.reason);
    });
    this.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      this._onprogress(notification);
    });
    this.setRequestHandler(PingRequestSchema, (_request) => ({}));
  }
  _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout, resetTimeoutOnProgress = false) {
    this._timeoutInfo.set(messageId, {
      timeoutId: setTimeout(onTimeout, timeout),
      startTime: Date.now(),
      timeout,
      maxTotalTimeout,
      resetTimeoutOnProgress,
      onTimeout
    });
  }
  _resetTimeout(messageId) {
    const info = this._timeoutInfo.get(messageId);
    if (!info)
      return false;
    const totalElapsed = Date.now() - info.startTime;
    if (info.maxTotalTimeout && totalElapsed >= info.maxTotalTimeout) {
      this._timeoutInfo.delete(messageId);
      throw new McpError(ErrorCode.RequestTimeout, "Maximum total timeout exceeded", { maxTotalTimeout: info.maxTotalTimeout, totalElapsed });
    }
    clearTimeout(info.timeoutId);
    info.timeoutId = setTimeout(info.onTimeout, info.timeout);
    return true;
  }
  _cleanupTimeout(messageId) {
    const info = this._timeoutInfo.get(messageId);
    if (info) {
      clearTimeout(info.timeoutId);
      this._timeoutInfo.delete(messageId);
    }
  }
  async connect(transport) {
    this._transport = transport;
    this._transport.onclose = () => {
      this._onclose();
    };
    this._transport.onerror = (error) => {
      this._onerror(error);
    };
    this._transport.onmessage = (message, extra) => {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        this._onresponse(message);
      } else if (isJSONRPCRequest(message)) {
        this._onrequest(message, extra);
      } else if (isJSONRPCNotification(message)) {
        this._onnotification(message);
      } else {
        this._onerror(new Error(`Unknown message type: ${JSON.stringify(message)}`));
      }
    };
    await this._transport.start();
  }
  _onclose() {
    var _a;
    const responseHandlers = this._responseHandlers;
    this._responseHandlers = new Map;
    this._progressHandlers.clear();
    this._transport = undefined;
    (_a = this.onclose) === null || _a === undefined || _a.call(this);
    const error = new McpError(ErrorCode.ConnectionClosed, "Connection closed");
    for (const handler of responseHandlers.values()) {
      handler(error);
    }
  }
  _onerror(error) {
    var _a;
    (_a = this.onerror) === null || _a === undefined || _a.call(this, error);
  }
  _onnotification(notification) {
    var _a;
    const handler = (_a = this._notificationHandlers.get(notification.method)) !== null && _a !== undefined ? _a : this.fallbackNotificationHandler;
    if (handler === undefined) {
      return;
    }
    Promise.resolve().then(() => handler(notification)).catch((error) => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
  }
  _onrequest(request, extra) {
    var _a, _b, _c, _d;
    const handler = (_a = this._requestHandlers.get(request.method)) !== null && _a !== undefined ? _a : this.fallbackRequestHandler;
    if (handler === undefined) {
      (_b = this._transport) === null || _b === undefined || _b.send({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: ErrorCode.MethodNotFound,
          message: "Method not found"
        }
      }).catch((error) => this._onerror(new Error(`Failed to send an error response: ${error}`)));
      return;
    }
    const abortController = new AbortController;
    this._requestHandlerAbortControllers.set(request.id, abortController);
    const fullExtra = {
      signal: abortController.signal,
      sessionId: (_c = this._transport) === null || _c === undefined ? undefined : _c.sessionId,
      _meta: (_d = request.params) === null || _d === undefined ? undefined : _d._meta,
      sendNotification: (notification) => this.notification(notification, { relatedRequestId: request.id }),
      sendRequest: (r, resultSchema, options) => this.request(r, resultSchema, { ...options, relatedRequestId: request.id }),
      authInfo: extra === null || extra === undefined ? undefined : extra.authInfo,
      requestId: request.id
    };
    Promise.resolve().then(() => handler(request, fullExtra)).then((result) => {
      var _a2;
      if (abortController.signal.aborted) {
        return;
      }
      return (_a2 = this._transport) === null || _a2 === undefined ? undefined : _a2.send({
        result,
        jsonrpc: "2.0",
        id: request.id
      });
    }, (error) => {
      var _a2, _b2;
      if (abortController.signal.aborted) {
        return;
      }
      return (_a2 = this._transport) === null || _a2 === undefined ? undefined : _a2.send({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: Number.isSafeInteger(error["code"]) ? error["code"] : ErrorCode.InternalError,
          message: (_b2 = error.message) !== null && _b2 !== undefined ? _b2 : "Internal error"
        }
      });
    }).catch((error) => this._onerror(new Error(`Failed to send response: ${error}`))).finally(() => {
      this._requestHandlerAbortControllers.delete(request.id);
    });
  }
  _onprogress(notification) {
    const { progressToken, ...params } = notification.params;
    const messageId = Number(progressToken);
    const handler = this._progressHandlers.get(messageId);
    if (!handler) {
      this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
      return;
    }
    const responseHandler = this._responseHandlers.get(messageId);
    const timeoutInfo = this._timeoutInfo.get(messageId);
    if (timeoutInfo && responseHandler && timeoutInfo.resetTimeoutOnProgress) {
      try {
        this._resetTimeout(messageId);
      } catch (error) {
        responseHandler(error);
        return;
      }
    }
    handler(params);
  }
  _onresponse(response) {
    const messageId = Number(response.id);
    const handler = this._responseHandlers.get(messageId);
    if (handler === undefined) {
      this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
      return;
    }
    this._responseHandlers.delete(messageId);
    this._progressHandlers.delete(messageId);
    this._cleanupTimeout(messageId);
    if (isJSONRPCResponse(response)) {
      handler(response);
    } else {
      const error = new McpError(response.error.code, response.error.message, response.error.data);
      handler(error);
    }
  }
  get transport() {
    return this._transport;
  }
  async close() {
    var _a;
    await ((_a = this._transport) === null || _a === undefined ? undefined : _a.close());
  }
  request(request, resultSchema, options) {
    const { relatedRequestId, resumptionToken, onresumptiontoken } = options !== null && options !== undefined ? options : {};
    return new Promise((resolve, reject) => {
      var _a, _b, _c, _d, _e, _f;
      if (!this._transport) {
        reject(new Error("Not connected"));
        return;
      }
      if (((_a = this._options) === null || _a === undefined ? undefined : _a.enforceStrictCapabilities) === true) {
        this.assertCapabilityForMethod(request.method);
      }
      (_b = options === null || options === undefined ? undefined : options.signal) === null || _b === undefined || _b.throwIfAborted();
      const messageId = this._requestMessageId++;
      const jsonrpcRequest = {
        ...request,
        jsonrpc: "2.0",
        id: messageId
      };
      if (options === null || options === undefined ? undefined : options.onprogress) {
        this._progressHandlers.set(messageId, options.onprogress);
        jsonrpcRequest.params = {
          ...request.params,
          _meta: {
            ...((_c = request.params) === null || _c === undefined ? undefined : _c._meta) || {},
            progressToken: messageId
          }
        };
      }
      const cancel = (reason) => {
        var _a2;
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        (_a2 = this._transport) === null || _a2 === undefined || _a2.send({
          jsonrpc: "2.0",
          method: "notifications/cancelled",
          params: {
            requestId: messageId,
            reason: String(reason)
          }
        }, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error) => this._onerror(new Error(`Failed to send cancellation: ${error}`)));
        reject(reason);
      };
      this._responseHandlers.set(messageId, (response) => {
        var _a2;
        if ((_a2 = options === null || options === undefined ? undefined : options.signal) === null || _a2 === undefined ? undefined : _a2.aborted) {
          return;
        }
        if (response instanceof Error) {
          return reject(response);
        }
        try {
          const result = resultSchema.parse(response.result);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      (_d = options === null || options === undefined ? undefined : options.signal) === null || _d === undefined || _d.addEventListener("abort", () => {
        var _a2;
        cancel((_a2 = options === null || options === undefined ? undefined : options.signal) === null || _a2 === undefined ? undefined : _a2.reason);
      });
      const timeout = (_e = options === null || options === undefined ? undefined : options.timeout) !== null && _e !== undefined ? _e : DEFAULT_REQUEST_TIMEOUT_MSEC;
      const timeoutHandler = () => cancel(new McpError(ErrorCode.RequestTimeout, "Request timed out", { timeout }));
      this._setupTimeout(messageId, timeout, options === null || options === undefined ? undefined : options.maxTotalTimeout, timeoutHandler, (_f = options === null || options === undefined ? undefined : options.resetTimeoutOnProgress) !== null && _f !== undefined ? _f : false);
      this._transport.send(jsonrpcRequest, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error) => {
        this._cleanupTimeout(messageId);
        reject(error);
      });
    });
  }
  async notification(notification, options) {
    if (!this._transport) {
      throw new Error("Not connected");
    }
    this.assertNotificationCapability(notification.method);
    const jsonrpcNotification = {
      ...notification,
      jsonrpc: "2.0"
    };
    await this._transport.send(jsonrpcNotification, options);
  }
  setRequestHandler(requestSchema, handler) {
    const method = requestSchema.shape.method.value;
    this.assertRequestHandlerCapability(method);
    this._requestHandlers.set(method, (request, extra) => {
      return Promise.resolve(handler(requestSchema.parse(request), extra));
    });
  }
  removeRequestHandler(method) {
    this._requestHandlers.delete(method);
  }
  assertCanSetRequestHandler(method) {
    if (this._requestHandlers.has(method)) {
      throw new Error(`A request handler for ${method} already exists, which would be overridden`);
    }
  }
  setNotificationHandler(notificationSchema, handler) {
    this._notificationHandlers.set(notificationSchema.shape.method.value, (notification) => Promise.resolve(handler(notificationSchema.parse(notification))));
  }
  removeNotificationHandler(method) {
    this._notificationHandlers.delete(method);
  }
}
function mergeCapabilities(base, additional) {
  return Object.entries(additional).reduce((acc, [key, value]) => {
    if (value && typeof value === "object") {
      acc[key] = acc[key] ? { ...acc[key], ...value } : value;
    } else {
      acc[key] = value;
    }
    return acc;
  }, { ...base });
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js
var import_ajv = __toESM(require_ajv(), 1);

class Server extends Protocol {
  constructor(_serverInfo, options) {
    var _a;
    super(options);
    this._serverInfo = _serverInfo;
    this._capabilities = (_a = options === null || options === undefined ? undefined : options.capabilities) !== null && _a !== undefined ? _a : {};
    this._instructions = options === null || options === undefined ? undefined : options.instructions;
    this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request));
    this.setNotificationHandler(InitializedNotificationSchema, () => {
      var _a2;
      return (_a2 = this.oninitialized) === null || _a2 === undefined ? undefined : _a2.call(this);
    });
  }
  registerCapabilities(capabilities) {
    if (this.transport) {
      throw new Error("Cannot register capabilities after connecting to transport");
    }
    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }
  assertCapabilityForMethod(method) {
    var _a, _b, _c;
    switch (method) {
      case "sampling/createMessage":
        if (!((_a = this._clientCapabilities) === null || _a === undefined ? undefined : _a.sampling)) {
          throw new Error(`Client does not support sampling (required for ${method})`);
        }
        break;
      case "elicitation/create":
        if (!((_b = this._clientCapabilities) === null || _b === undefined ? undefined : _b.elicitation)) {
          throw new Error(`Client does not support elicitation (required for ${method})`);
        }
        break;
      case "roots/list":
        if (!((_c = this._clientCapabilities) === null || _c === undefined ? undefined : _c.roots)) {
          throw new Error(`Client does not support listing roots (required for ${method})`);
        }
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/message":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support notifying about resources (required for ${method})`);
        }
        break;
      case "notifications/tools/list_changed":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
        }
        break;
      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
        }
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability(method) {
    switch (method) {
      case "sampling/createMessage":
        if (!this._capabilities.sampling) {
          throw new Error(`Server does not support sampling (required for ${method})`);
        }
        break;
      case "logging/setLevel":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support prompts (required for ${method})`);
        }
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support resources (required for ${method})`);
        }
        break;
      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support tools (required for ${method})`);
        }
        break;
      case "ping":
      case "initialize":
        break;
    }
  }
  async _oninitialize(request) {
    const requestedVersion = request.params.protocolVersion;
    this._clientCapabilities = request.params.capabilities;
    this._clientVersion = request.params.clientInfo;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
    return {
      protocolVersion,
      capabilities: this.getCapabilities(),
      serverInfo: this._serverInfo,
      ...this._instructions && { instructions: this._instructions }
    };
  }
  getClientCapabilities() {
    return this._clientCapabilities;
  }
  getClientVersion() {
    return this._clientVersion;
  }
  getCapabilities() {
    return this._capabilities;
  }
  async ping() {
    return this.request({ method: "ping" }, EmptyResultSchema);
  }
  async createMessage(params, options) {
    return this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, options);
  }
  async elicitInput(params, options) {
    const result = await this.request({ method: "elicitation/create", params }, ElicitResultSchema, options);
    if (result.action === "accept" && result.content) {
      try {
        const ajv = new import_ajv.default;
        const validate = ajv.compile(params.requestedSchema);
        const isValid2 = validate(result.content);
        if (!isValid2) {
          throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${ajv.errorsText(validate.errors)}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error}`);
      }
    }
    return result;
  }
  async listRoots(params, options) {
    return this.request({ method: "roots/list", params }, ListRootsResultSchema, options);
  }
  async sendLoggingMessage(params) {
    return this.notification({ method: "notifications/message", params });
  }
  async sendResourceUpdated(params) {
    return this.notification({
      method: "notifications/resources/updated",
      params
    });
  }
  async sendResourceListChanged() {
    return this.notification({
      method: "notifications/resources/list_changed"
    });
  }
  async sendToolListChanged() {
    return this.notification({ method: "notifications/tools/list_changed" });
  }
  async sendPromptListChanged() {
    return this.notification({ method: "notifications/prompts/list_changed" });
  }
}

// node_modules/zod-to-json-schema/dist/esm/Options.js
var ignoreOverride = Symbol("Let zodToJsonSchema decide on which parser to use");
var defaultOptions = {
  name: undefined,
  $refStrategy: "root",
  basePath: ["#"],
  effectStrategy: "input",
  pipeStrategy: "all",
  dateStrategy: "format:date-time",
  mapStrategy: "entries",
  removeAdditionalStrategy: "passthrough",
  allowedAdditionalProperties: true,
  rejectedAdditionalProperties: false,
  definitionPath: "definitions",
  target: "jsonSchema7",
  strictUnions: false,
  definitions: {},
  errorMessages: false,
  markdownDescription: false,
  patternStrategy: "escape",
  applyRegexFlags: false,
  emailStrategy: "format:email",
  base64Strategy: "contentEncoding:base64",
  nameStrategy: "ref"
};
var getDefaultOptions = (options) => typeof options === "string" ? {
  ...defaultOptions,
  name: options
} : {
  ...defaultOptions,
  ...options
};
// node_modules/zod-to-json-schema/dist/esm/Refs.js
var getRefs = (options) => {
  const _options = getDefaultOptions(options);
  const currentPath = _options.name !== undefined ? [..._options.basePath, _options.definitionPath, _options.name] : _options.basePath;
  return {
    ..._options,
    currentPath,
    propertyPath: undefined,
    seen: new Map(Object.entries(_options.definitions).map(([name, def]) => [
      def._def,
      {
        def: def._def,
        path: [..._options.basePath, _options.definitionPath, name],
        jsonSchema: undefined
      }
    ]))
  };
};
// node_modules/zod-to-json-schema/dist/esm/errorMessages.js
function addErrorMessage(res, key, errorMessage, refs) {
  if (!refs?.errorMessages)
    return;
  if (errorMessage) {
    res.errorMessage = {
      ...res.errorMessage,
      [key]: errorMessage
    };
  }
}
function setResponseValueAndErrors(res, key, value, errorMessage, refs) {
  res[key] = value;
  addErrorMessage(res, key, errorMessage, refs);
}
// node_modules/zod/lib/index.mjs
var util2;
(function(util3) {
  util3.assertEqual = (val) => val;
  function assertIs(_arg) {}
  util3.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error;
  }
  util3.assertNever = assertNever;
  util3.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util3.getValidEnumValues = (obj) => {
    const validKeys = util3.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util3.objectValues(filtered);
  };
  util3.objectValues = (obj) => {
    return util3.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util3.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util3.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return;
  };
  util3.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util3.joinValues = joinValues;
  util3.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util2 || (util2 = {}));
var objectUtil2;
(function(objectUtil3) {
  objectUtil3.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
    };
  };
})(objectUtil2 || (objectUtil2 = {}));
var ZodParsedType2 = util2.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType2 = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType2.undefined;
    case "string":
      return ZodParsedType2.string;
    case "number":
      return isNaN(data) ? ZodParsedType2.nan : ZodParsedType2.number;
    case "boolean":
      return ZodParsedType2.boolean;
    case "function":
      return ZodParsedType2.function;
    case "bigint":
      return ZodParsedType2.bigint;
    case "symbol":
      return ZodParsedType2.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType2.array;
      }
      if (data === null) {
        return ZodParsedType2.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType2.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType2.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType2.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType2.date;
      }
      return ZodParsedType2.object;
    default:
      return ZodParsedType2.unknown;
  }
};
var ZodIssueCode2 = util2.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson2 = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError2 extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util2.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError2.create = (issues) => {
  const error = new ZodError2(issues);
  return error;
};
var errorMap2 = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode2.invalid_type:
      if (issue.received === ZodParsedType2.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode2.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util2.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode2.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util2.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode2.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode2.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util2.joinValues(issue.options)}`;
      break;
    case ZodIssueCode2.invalid_enum_value:
      message = `Invalid enum value. Expected ${util2.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode2.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode2.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode2.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode2.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util2.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode2.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode2.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode2.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode2.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode2.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode2.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util2.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap2 = errorMap2;
function setErrorMap2(map) {
  overrideErrorMap2 = map;
}
function getErrorMap2() {
  return overrideErrorMap2;
}
var makeIssue2 = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: issueData.message || errorMessage
  };
};
var EMPTY_PATH2 = [];
function addIssueToContext2(ctx, issueData) {
  const issue = makeIssue2({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      getErrorMap2(),
      errorMap2
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}

class ParseStatus2 {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID2;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      syncPairs.push({
        key: await pair.key,
        value: await pair.value
      });
    }
    return ParseStatus2.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID2;
      if (value.status === "aborted")
        return INVALID2;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var INVALID2 = Object.freeze({
  status: "aborted"
});
var DIRTY2 = (value) => ({ status: "dirty", value });
var OK2 = (value) => ({ status: "valid", value });
var isAborted2 = (x) => x.status === "aborted";
var isDirty2 = (x) => x.status === "dirty";
var isValid2 = (x) => x.status === "valid";
var isAsync2 = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var errorUtil2;
(function(errorUtil3) {
  errorUtil3.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil3.toString = (message) => typeof message === "string" ? message : message === null || message === undefined ? undefined : message.message;
})(errorUtil2 || (errorUtil2 = {}));

class ParseInputLazyPath2 {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
var handleResult2 = (ctx, result) => {
  if (isValid2(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError2(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams2(params) {
  if (!params)
    return {};
  const { errorMap: errorMap3, invalid_type_error, required_error, description } = params;
  if (errorMap3 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap3)
    return { errorMap: errorMap3, description };
  const customMap = (iss, ctx) => {
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    if (typeof ctx.data === "undefined") {
      return { message: required_error !== null && required_error !== undefined ? required_error : ctx.defaultError };
    }
    return { message: invalid_type_error !== null && invalid_type_error !== undefined ? invalid_type_error : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

class ZodType2 {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType2(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType2(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus2,
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType2(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync2(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === undefined ? undefined : params.async) !== null && _a !== undefined ? _a : false,
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType2(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult2(ctx, result);
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap,
        async: true
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType2(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync2(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult2(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode2.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects2({
      schema: this,
      typeName: ZodFirstPartyTypeKind2.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional2.create(this, this._def);
  }
  nullable() {
    return ZodNullable2.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray2.create(this, this._def);
  }
  promise() {
    return ZodPromise2.create(this, this._def);
  }
  or(option) {
    return ZodUnion2.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection2.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects2({
      ...processCreateParams2(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind2.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault2({
      ...processCreateParams2(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind2.ZodDefault
    });
  }
  brand() {
    return new ZodBranded2({
      typeName: ZodFirstPartyTypeKind2.ZodBranded,
      type: this,
      ...processCreateParams2(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch2({
      ...processCreateParams2(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind2.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline2.create(this, target);
  }
  readonly() {
    return ZodReadonly2.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var cuidRegex2 = /^c[^\s-]{8,}$/i;
var cuid2Regex2 = /^[a-z][a-z0-9]*$/;
var ulidRegex2 = /^[0-9A-HJKMNP-TV-Z]{26}$/;
var uuidRegex2 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var emailRegex2 = /^(?!\.)(?!.*\.\.)([A-Z0-9_+-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex2 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex2;
var ipv4Regex2 = /^(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))$/;
var ipv6Regex2 = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
var datetimeRegex2 = (args) => {
  if (args.precision) {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}Z$`);
    }
  } else if (args.precision === 0) {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$`);
    }
  } else {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$`);
    }
  }
};
function isValidIP2(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex2.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex2.test(ip)) {
    return true;
  }
  return false;
}

class ZodString2 extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.string,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const status = new ParseStatus2;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext2(ctx, {
              code: ZodIssueCode2.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext2(ctx, {
              code: ZodIssueCode2.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "email",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex2) {
          emojiRegex2 = new RegExp(_emojiRegex2, "u");
        }
        if (!emojiRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "emoji",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "uuid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "cuid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "cuid2",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex2.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "ulid",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "url",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "regex",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex2(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP2(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            validation: "ip",
            code: ZodIssueCode2.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode2.invalid_string,
      ...errorUtil2.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString2({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil2.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil2.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil2.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil2.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil2.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil2.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil2.errToObj(message) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil2.errToObj(options) });
  }
  datetime(options) {
    var _a;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === undefined ? undefined : options.precision) === "undefined" ? null : options === null || options === undefined ? undefined : options.precision,
      offset: (_a = options === null || options === undefined ? undefined : options.offset) !== null && _a !== undefined ? _a : false,
      ...errorUtil2.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil2.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === undefined ? undefined : options.position,
      ...errorUtil2.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil2.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil2.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil2.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil2.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil2.errToObj(message)
    });
  }
  nonempty(message) {
    return this.min(1, errorUtil2.errToObj(message));
  }
  trim() {
    return new ZodString2({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString2({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString2({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString2.create = (params) => {
  var _a;
  return new ZodString2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodString,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams2(params)
  });
};
function floatSafeRemainder2(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}

class ZodNumber2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.number,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    let ctx = undefined;
    const status = new ParseStatus2;
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util2.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder2(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil2.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil2.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil2.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil2.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber2({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil2.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber2({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil2.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil2.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil2.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil2.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil2.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util2.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber2.create = (params) => {
  return new ZodNumber2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodNumber,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams2(params)
  });
};

class ZodBigInt2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.bigint,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    let ctx = undefined;
    const status = new ParseStatus2;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil2.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil2.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil2.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil2.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt2({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil2.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt2({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil2.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil2.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil2.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt2.create = (params) => {
  var _a;
  return new ZodBigInt2({
    checks: [],
    typeName: ZodFirstPartyTypeKind2.ZodBigInt,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams2(params)
  });
};

class ZodBoolean2 extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.boolean,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
}
ZodBoolean2.create = (params) => {
  return new ZodBoolean2({
    typeName: ZodFirstPartyTypeKind2.ZodBoolean,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams2(params)
  });
};

class ZodDate2 extends ZodType2 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.date,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_date
      });
      return INVALID2;
    }
    const status = new ParseStatus2;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate2({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil2.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil2.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate2.create = (params) => {
  return new ZodDate2({
    checks: [],
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind2.ZodDate,
    ...processCreateParams2(params)
  });
};

class ZodSymbol2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.symbol,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
}
ZodSymbol2.create = (params) => {
  return new ZodSymbol2({
    typeName: ZodFirstPartyTypeKind2.ZodSymbol,
    ...processCreateParams2(params)
  });
};

class ZodUndefined2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.undefined,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
}
ZodUndefined2.create = (params) => {
  return new ZodUndefined2({
    typeName: ZodFirstPartyTypeKind2.ZodUndefined,
    ...processCreateParams2(params)
  });
};

class ZodNull2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.null,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
}
ZodNull2.create = (params) => {
  return new ZodNull2({
    typeName: ZodFirstPartyTypeKind2.ZodNull,
    ...processCreateParams2(params)
  });
};

class ZodAny2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK2(input.data);
  }
}
ZodAny2.create = (params) => {
  return new ZodAny2({
    typeName: ZodFirstPartyTypeKind2.ZodAny,
    ...processCreateParams2(params)
  });
};

class ZodUnknown2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK2(input.data);
  }
}
ZodUnknown2.create = (params) => {
  return new ZodUnknown2({
    typeName: ZodFirstPartyTypeKind2.ZodUnknown,
    ...processCreateParams2(params)
  });
};

class ZodNever2 extends ZodType2 {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext2(ctx, {
      code: ZodIssueCode2.invalid_type,
      expected: ZodParsedType2.never,
      received: ctx.parsedType
    });
    return INVALID2;
  }
}
ZodNever2.create = (params) => {
  return new ZodNever2({
    typeName: ZodFirstPartyTypeKind2.ZodNever,
    ...processCreateParams2(params)
  });
};

class ZodVoid2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.void,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
}
ZodVoid2.create = (params) => {
  return new ZodVoid2({
    typeName: ZodFirstPartyTypeKind2.ZodVoid,
    ...processCreateParams2(params)
  });
};

class ZodArray2 extends ZodType2 {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType2.array) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext2(ctx, {
          code: tooBig ? ZodIssueCode2.too_big : ZodIssueCode2.too_small,
          minimum: tooSmall ? def.exactLength.value : undefined,
          maximum: tooBig ? def.exactLength.value : undefined,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath2(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus2.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath2(ctx, item, ctx.path, i));
    });
    return ParseStatus2.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray2({
      ...this._def,
      minLength: { value: minLength, message: errorUtil2.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray2({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil2.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray2({
      ...this._def,
      exactLength: { value: len, message: errorUtil2.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray2.create = (schema, params) => {
  return new ZodArray2({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind2.ZodArray,
    ...processCreateParams2(params)
  });
};
function deepPartialify2(schema) {
  if (schema instanceof ZodObject2) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional2.create(deepPartialify2(fieldSchema));
    }
    return new ZodObject2({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray2) {
    return new ZodArray2({
      ...schema._def,
      type: deepPartialify2(schema.element)
    });
  } else if (schema instanceof ZodOptional2) {
    return ZodOptional2.create(deepPartialify2(schema.unwrap()));
  } else if (schema instanceof ZodNullable2) {
    return ZodNullable2.create(deepPartialify2(schema.unwrap()));
  } else if (schema instanceof ZodTuple2) {
    return ZodTuple2.create(schema.items.map((item) => deepPartialify2(item)));
  } else {
    return schema;
  }
}

class ZodObject2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util2.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext2(ctx2, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever2 && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath2(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever2) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext2(ctx, {
            code: ZodIssueCode2.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip")
        ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(new ParseInputLazyPath2(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          syncPairs.push({
            key,
            value: await pair.value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus2.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus2.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil2.errToObj;
    return new ZodObject2({
      ...this._def,
      unknownKeys: "strict",
      ...message !== undefined ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === undefined ? undefined : _b.call(_a, issue, ctx).message) !== null && _c !== undefined ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil2.errToObj(message).message) !== null && _d !== undefined ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject2({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject2({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  extend(augmentation) {
    return new ZodObject2({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  merge(merging) {
    const merged = new ZodObject2({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind2.ZodObject
    });
    return merged;
  }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  catchall(index) {
    return new ZodObject2({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util2.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject2({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject2({
      ...this._def,
      shape: () => shape
    });
  }
  deepPartial() {
    return deepPartialify2(this);
  }
  partial(mask) {
    const newShape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new ZodObject2({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional2) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new ZodObject2({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum2(util2.objectKeys(this.shape));
  }
}
ZodObject2.create = (shape, params) => {
  return new ZodObject2({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};
ZodObject2.strictCreate = (shape, params) => {
  return new ZodObject2({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};
ZodObject2.lazycreate = (shape, params) => {
  return new ZodObject2({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever2.create(),
    typeName: ZodFirstPartyTypeKind2.ZodObject,
    ...processCreateParams2(params)
  });
};

class ZodUnion2 extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError2(result.ctx.common.issues));
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = undefined;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError2(issues2));
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion2.create = (types, params) => {
  return new ZodUnion2({
    options: types,
    typeName: ZodFirstPartyTypeKind2.ZodUnion,
    ...processCreateParams2(params)
  });
};
var getDiscriminator2 = (type) => {
  if (type instanceof ZodLazy2) {
    return getDiscriminator2(type.schema);
  } else if (type instanceof ZodEffects2) {
    return getDiscriminator2(type.innerType());
  } else if (type instanceof ZodLiteral2) {
    return [type.value];
  } else if (type instanceof ZodEnum2) {
    return type.options;
  } else if (type instanceof ZodNativeEnum2) {
    return Object.keys(type.enum);
  } else if (type instanceof ZodDefault2) {
    return getDiscriminator2(type._def.innerType);
  } else if (type instanceof ZodUndefined2) {
    return [undefined];
  } else if (type instanceof ZodNull2) {
    return [null];
  } else {
    return null;
  }
};

class ZodDiscriminatedUnion2 extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.object) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(discriminator, options, params) {
    const optionsMap = new Map;
    for (const type of options) {
      const discriminatorValues = getDiscriminator2(type.shape[discriminator]);
      if (!discriminatorValues) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion2({
      typeName: ZodFirstPartyTypeKind2.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams2(params)
    });
  }
}
function mergeValues2(a, b) {
  const aType = getParsedType2(a);
  const bType = getParsedType2(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType2.object && bType === ZodParsedType2.object) {
    const bKeys = util2.objectKeys(b);
    const sharedKeys = util2.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues2(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType2.array && bType === ZodParsedType2.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues2(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType2.date && bType === ZodParsedType2.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}

class ZodIntersection2 extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted2(parsedLeft) || isAborted2(parsedRight)) {
        return INVALID2;
      }
      const merged = mergeValues2(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.invalid_intersection_types
        });
        return INVALID2;
      }
      if (isDirty2(parsedLeft) || isDirty2(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection2.create = (left, right, params) => {
  return new ZodIntersection2({
    left,
    right,
    typeName: ZodFirstPartyTypeKind2.ZodIntersection,
    ...processCreateParams2(params)
  });
};

class ZodTuple2 extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.array) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID2;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath2(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus2.mergeArray(status, results);
      });
    } else {
      return ParseStatus2.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple2({
      ...this._def,
      rest
    });
  }
}
ZodTuple2.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple2({
    items: schemas,
    typeName: ZodFirstPartyTypeKind2.ZodTuple,
    rest: null,
    ...processCreateParams2(params)
  });
};

class ZodRecord2 extends ZodType2 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.object) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath2(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath2(ctx, ctx.data[key], ctx.path, key))
      });
    }
    if (ctx.common.async) {
      return ParseStatus2.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus2.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType2) {
      return new ZodRecord2({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind2.ZodRecord,
        ...processCreateParams2(third)
      });
    }
    return new ZodRecord2({
      keyType: ZodString2.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind2.ZodRecord,
      ...processCreateParams2(second)
    });
  }
}

class ZodMap2 extends ZodType2 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.map) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.map,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath2(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath2(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = new Map;
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID2;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = new Map;
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID2;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap2.create = (keyType, valueType, params) => {
  return new ZodMap2({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind2.ZodMap,
    ...processCreateParams2(params)
  });
};

class ZodSet2 extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.set) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.set,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext2(ctx, {
          code: ZodIssueCode2.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = new Set;
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID2;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath2(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet2({
      ...this._def,
      minSize: { value: minSize, message: errorUtil2.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet2({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil2.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet2.create = (valueType, params) => {
  return new ZodSet2({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind2.ZodSet,
    ...processCreateParams2(params)
  });
};

class ZodFunction2 extends ZodType2 {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.function) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.function,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    function makeArgsIssue(args, error) {
      return makeIssue2({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap2(),
          errorMap2
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode2.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue2({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap2(),
          errorMap2
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode2.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise2) {
      const me = this;
      return OK2(async function(...args) {
        const error = new ZodError2([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK2(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError2([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError2([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction2({
      ...this._def,
      args: ZodTuple2.create(items).rest(ZodUnknown2.create())
    });
  }
  returns(returnType) {
    return new ZodFunction2({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction2({
      args: args ? args : ZodTuple2.create([]).rest(ZodUnknown2.create()),
      returns: returns || ZodUnknown2.create(),
      typeName: ZodFirstPartyTypeKind2.ZodFunction,
      ...processCreateParams2(params)
    });
  }
}

class ZodLazy2 extends ZodType2 {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy2.create = (getter, params) => {
  return new ZodLazy2({
    getter,
    typeName: ZodFirstPartyTypeKind2.ZodLazy,
    ...processCreateParams2(params)
  });
};

class ZodLiteral2 extends ZodType2 {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_literal,
        expected: this._def.value
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral2.create = (value, params) => {
  return new ZodLiteral2({
    value,
    typeName: ZodFirstPartyTypeKind2.ZodLiteral,
    ...processCreateParams2(params)
  });
};
function createZodEnum2(values, params) {
  return new ZodEnum2({
    values,
    typeName: ZodFirstPartyTypeKind2.ZodEnum,
    ...processCreateParams2(params)
  });
}

class ZodEnum2 extends ZodType2 {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext2(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode2.invalid_type
      });
      return INVALID2;
    }
    if (this._def.values.indexOf(input.data) === -1) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values) {
    return ZodEnum2.create(values);
  }
  exclude(values) {
    return ZodEnum2.create(this.options.filter((opt) => !values.includes(opt)));
  }
}
ZodEnum2.create = createZodEnum2;

class ZodNativeEnum2 extends ZodType2 {
  _parse(input) {
    const nativeEnumValues = util2.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType2.string && ctx.parsedType !== ZodParsedType2.number) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext2(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode2.invalid_type
      });
      return INVALID2;
    }
    if (nativeEnumValues.indexOf(input.data) === -1) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext2(ctx, {
        received: ctx.data,
        code: ZodIssueCode2.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK2(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum2.create = (values, params) => {
  return new ZodNativeEnum2({
    values,
    typeName: ZodFirstPartyTypeKind2.ZodNativeEnum,
    ...processCreateParams2(params)
  });
};

class ZodPromise2 extends ZodType2 {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType2.promise && ctx.common.async === false) {
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.promise,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const promisified = ctx.parsedType === ZodParsedType2.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK2(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise2.create = (schema, params) => {
  return new ZodPromise2({
    type: schema,
    typeName: ZodFirstPartyTypeKind2.ZodPromise,
    ...processCreateParams2(params)
  });
};

class ZodEffects2 extends ZodType2 {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind2.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext2(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.issues.length) {
        return {
          status: "dirty",
          value: ctx.data
        };
      }
      if (ctx.common.async) {
        return Promise.resolve(processed).then((processed2) => {
          return this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
        });
      } else {
        return this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID2;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID2;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid2(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid2(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util2.assertNever(effect);
  }
}
ZodEffects2.create = (schema, effect, params) => {
  return new ZodEffects2({
    schema,
    typeName: ZodFirstPartyTypeKind2.ZodEffects,
    effect,
    ...processCreateParams2(params)
  });
};
ZodEffects2.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects2({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind2.ZodEffects,
    ...processCreateParams2(params)
  });
};

class ZodOptional2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType2.undefined) {
      return OK2(undefined);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional2.create = (type, params) => {
  return new ZodOptional2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodOptional,
    ...processCreateParams2(params)
  });
};

class ZodNullable2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType2.null) {
      return OK2(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable2.create = (type, params) => {
  return new ZodNullable2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodNullable,
    ...processCreateParams2(params)
  });
};

class ZodDefault2 extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType2.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault2.create = (type, params) => {
  return new ZodDefault2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams2(params)
  });
};

class ZodCatch2 extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync2(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError2(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError2(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch2.create = (type, params) => {
  return new ZodCatch2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams2(params)
  });
};

class ZodNaN2 extends ZodType2 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType2.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext2(ctx, {
        code: ZodIssueCode2.invalid_type,
        expected: ZodParsedType2.nan,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN2.create = (params) => {
  return new ZodNaN2({
    typeName: ZodFirstPartyTypeKind2.ZodNaN,
    ...processCreateParams2(params)
  });
};
var BRAND2 = Symbol("zod_brand");

class ZodBranded2 extends ZodType2 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}

class ZodPipeline2 extends ZodType2 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID2;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY2(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID2;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline2({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind2.ZodPipeline
    });
  }
}

class ZodReadonly2 extends ZodType2 {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    if (isValid2(result)) {
      result.value = Object.freeze(result.value);
    }
    return result;
  }
}
ZodReadonly2.create = (type, params) => {
  return new ZodReadonly2({
    innerType: type,
    typeName: ZodFirstPartyTypeKind2.ZodReadonly,
    ...processCreateParams2(params)
  });
};
var custom2 = (check, params = {}, fatal) => {
  if (check)
    return ZodAny2.create().superRefine((data, ctx) => {
      var _a, _b;
      if (!check(data)) {
        const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a = p.fatal) !== null && _a !== undefined ? _a : fatal) !== null && _b !== undefined ? _b : true;
        const p2 = typeof p === "string" ? { message: p } : p;
        ctx.addIssue({ code: "custom", ...p2, fatal: _fatal });
      }
    });
  return ZodAny2.create();
};
var late2 = {
  object: ZodObject2.lazycreate
};
var ZodFirstPartyTypeKind2;
(function(ZodFirstPartyTypeKind3) {
  ZodFirstPartyTypeKind3["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind3["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind3["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind3["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind3["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind3["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind3["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind3["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind3["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind3["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind3["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind3["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind3["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind3["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind3["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind3["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind3["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind3["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind3["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind3["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind3["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind3["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind3["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind3["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind3["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind3["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind3["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind3["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind3["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind3["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind3["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind3["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind3["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind3["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind3["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind3["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind2 || (ZodFirstPartyTypeKind2 = {}));
var instanceOfType2 = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom2((data) => data instanceof cls, params);
var stringType2 = ZodString2.create;
var numberType2 = ZodNumber2.create;
var nanType2 = ZodNaN2.create;
var bigIntType2 = ZodBigInt2.create;
var booleanType2 = ZodBoolean2.create;
var dateType2 = ZodDate2.create;
var symbolType2 = ZodSymbol2.create;
var undefinedType2 = ZodUndefined2.create;
var nullType2 = ZodNull2.create;
var anyType2 = ZodAny2.create;
var unknownType2 = ZodUnknown2.create;
var neverType2 = ZodNever2.create;
var voidType2 = ZodVoid2.create;
var arrayType2 = ZodArray2.create;
var objectType2 = ZodObject2.create;
var strictObjectType2 = ZodObject2.strictCreate;
var unionType2 = ZodUnion2.create;
var discriminatedUnionType2 = ZodDiscriminatedUnion2.create;
var intersectionType2 = ZodIntersection2.create;
var tupleType2 = ZodTuple2.create;
var recordType2 = ZodRecord2.create;
var mapType2 = ZodMap2.create;
var setType2 = ZodSet2.create;
var functionType2 = ZodFunction2.create;
var lazyType2 = ZodLazy2.create;
var literalType2 = ZodLiteral2.create;
var enumType2 = ZodEnum2.create;
var nativeEnumType2 = ZodNativeEnum2.create;
var promiseType2 = ZodPromise2.create;
var effectsType2 = ZodEffects2.create;
var optionalType2 = ZodOptional2.create;
var nullableType2 = ZodNullable2.create;
var preprocessType2 = ZodEffects2.createWithPreprocess;
var pipelineType2 = ZodPipeline2.create;
var ostring2 = () => stringType2().optional();
var onumber2 = () => numberType2().optional();
var oboolean2 = () => booleanType2().optional();
var coerce2 = {
  string: (arg) => ZodString2.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber2.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean2.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt2.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate2.create({ ...arg, coerce: true })
};
var NEVER2 = INVALID2;
var z2 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap2,
  setErrorMap: setErrorMap2,
  getErrorMap: getErrorMap2,
  makeIssue: makeIssue2,
  EMPTY_PATH: EMPTY_PATH2,
  addIssueToContext: addIssueToContext2,
  ParseStatus: ParseStatus2,
  INVALID: INVALID2,
  DIRTY: DIRTY2,
  OK: OK2,
  isAborted: isAborted2,
  isDirty: isDirty2,
  isValid: isValid2,
  isAsync: isAsync2,
  get util() {
    return util2;
  },
  get objectUtil() {
    return objectUtil2;
  },
  ZodParsedType: ZodParsedType2,
  getParsedType: getParsedType2,
  ZodType: ZodType2,
  ZodString: ZodString2,
  ZodNumber: ZodNumber2,
  ZodBigInt: ZodBigInt2,
  ZodBoolean: ZodBoolean2,
  ZodDate: ZodDate2,
  ZodSymbol: ZodSymbol2,
  ZodUndefined: ZodUndefined2,
  ZodNull: ZodNull2,
  ZodAny: ZodAny2,
  ZodUnknown: ZodUnknown2,
  ZodNever: ZodNever2,
  ZodVoid: ZodVoid2,
  ZodArray: ZodArray2,
  ZodObject: ZodObject2,
  ZodUnion: ZodUnion2,
  ZodDiscriminatedUnion: ZodDiscriminatedUnion2,
  ZodIntersection: ZodIntersection2,
  ZodTuple: ZodTuple2,
  ZodRecord: ZodRecord2,
  ZodMap: ZodMap2,
  ZodSet: ZodSet2,
  ZodFunction: ZodFunction2,
  ZodLazy: ZodLazy2,
  ZodLiteral: ZodLiteral2,
  ZodEnum: ZodEnum2,
  ZodNativeEnum: ZodNativeEnum2,
  ZodPromise: ZodPromise2,
  ZodEffects: ZodEffects2,
  ZodTransformer: ZodEffects2,
  ZodOptional: ZodOptional2,
  ZodNullable: ZodNullable2,
  ZodDefault: ZodDefault2,
  ZodCatch: ZodCatch2,
  ZodNaN: ZodNaN2,
  BRAND: BRAND2,
  ZodBranded: ZodBranded2,
  ZodPipeline: ZodPipeline2,
  ZodReadonly: ZodReadonly2,
  custom: custom2,
  Schema: ZodType2,
  ZodSchema: ZodType2,
  late: late2,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind2;
  },
  coerce: coerce2,
  any: anyType2,
  array: arrayType2,
  bigint: bigIntType2,
  boolean: booleanType2,
  date: dateType2,
  discriminatedUnion: discriminatedUnionType2,
  effect: effectsType2,
  enum: enumType2,
  function: functionType2,
  instanceof: instanceOfType2,
  intersection: intersectionType2,
  lazy: lazyType2,
  literal: literalType2,
  map: mapType2,
  nan: nanType2,
  nativeEnum: nativeEnumType2,
  never: neverType2,
  null: nullType2,
  nullable: nullableType2,
  number: numberType2,
  object: objectType2,
  oboolean: oboolean2,
  onumber: onumber2,
  optional: optionalType2,
  ostring: ostring2,
  pipeline: pipelineType2,
  preprocess: preprocessType2,
  promise: promiseType2,
  record: recordType2,
  set: setType2,
  strictObject: strictObjectType2,
  string: stringType2,
  symbol: symbolType2,
  transformer: effectsType2,
  tuple: tupleType2,
  undefined: undefinedType2,
  union: unionType2,
  unknown: unknownType2,
  void: voidType2,
  NEVER: NEVER2,
  ZodIssueCode: ZodIssueCode2,
  quotelessJson: quotelessJson2,
  ZodError: ZodError2
});

// node_modules/zod-to-json-schema/dist/esm/parsers/any.js
function parseAnyDef() {
  return {};
}

// node_modules/zod-to-json-schema/dist/esm/parsers/array.js
function parseArrayDef(def, refs) {
  const res = {
    type: "array"
  };
  if (def.type?._def && def.type?._def?.typeName !== ZodFirstPartyTypeKind2.ZodAny) {
    res.items = parseDef(def.type._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items"]
    });
  }
  if (def.minLength) {
    setResponseValueAndErrors(res, "minItems", def.minLength.value, def.minLength.message, refs);
  }
  if (def.maxLength) {
    setResponseValueAndErrors(res, "maxItems", def.maxLength.value, def.maxLength.message, refs);
  }
  if (def.exactLength) {
    setResponseValueAndErrors(res, "minItems", def.exactLength.value, def.exactLength.message, refs);
    setResponseValueAndErrors(res, "maxItems", def.exactLength.value, def.exactLength.message, refs);
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/bigint.js
function parseBigintDef(def, refs) {
  const res = {
    type: "integer",
    format: "int64"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMinimum = true;
          }
          setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
        }
        break;
      case "max":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMaximum = true;
          }
          setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
        }
        break;
      case "multipleOf":
        setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
        break;
    }
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/boolean.js
function parseBooleanDef() {
  return {
    type: "boolean"
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/branded.js
function parseBrandedDef(_def, refs) {
  return parseDef(_def.type._def, refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/catch.js
var parseCatchDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};

// node_modules/zod-to-json-schema/dist/esm/parsers/date.js
function parseDateDef(def, refs, overrideDateStrategy) {
  const strategy = overrideDateStrategy ?? refs.dateStrategy;
  if (Array.isArray(strategy)) {
    return {
      anyOf: strategy.map((item, i) => parseDateDef(def, refs, item))
    };
  }
  switch (strategy) {
    case "string":
    case "format:date-time":
      return {
        type: "string",
        format: "date-time"
      };
    case "format:date":
      return {
        type: "string",
        format: "date"
      };
    case "integer":
      return integerDateParser(def, refs);
  }
}
var integerDateParser = (def, refs) => {
  const res = {
    type: "integer",
    format: "unix-time"
  };
  if (refs.target === "openApi3") {
    return res;
  }
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
        break;
      case "max":
        setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
        break;
    }
  }
  return res;
};

// node_modules/zod-to-json-schema/dist/esm/parsers/default.js
function parseDefaultDef(_def, refs) {
  return {
    ...parseDef(_def.innerType._def, refs),
    default: _def.defaultValue()
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/effects.js
function parseEffectsDef(_def, refs) {
  return refs.effectStrategy === "input" ? parseDef(_def.schema._def, refs) : {};
}

// node_modules/zod-to-json-schema/dist/esm/parsers/enum.js
function parseEnumDef(def) {
  return {
    type: "string",
    enum: Array.from(def.values)
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/intersection.js
var isJsonSchema7AllOfType = (type) => {
  if ("type" in type && type.type === "string")
    return false;
  return "allOf" in type;
};
function parseIntersectionDef(def, refs) {
  const allOf = [
    parseDef(def.left._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "0"]
    }),
    parseDef(def.right._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "1"]
    })
  ].filter((x) => !!x);
  let unevaluatedProperties = refs.target === "jsonSchema2019-09" ? { unevaluatedProperties: false } : undefined;
  const mergedAllOf = [];
  allOf.forEach((schema) => {
    if (isJsonSchema7AllOfType(schema)) {
      mergedAllOf.push(...schema.allOf);
      if (schema.unevaluatedProperties === undefined) {
        unevaluatedProperties = undefined;
      }
    } else {
      let nestedSchema = schema;
      if ("additionalProperties" in schema && schema.additionalProperties === false) {
        const { additionalProperties, ...rest } = schema;
        nestedSchema = rest;
      } else {
        unevaluatedProperties = undefined;
      }
      mergedAllOf.push(nestedSchema);
    }
  });
  return mergedAllOf.length ? {
    allOf: mergedAllOf,
    ...unevaluatedProperties
  } : undefined;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/literal.js
function parseLiteralDef(def, refs) {
  const parsedType = typeof def.value;
  if (parsedType !== "bigint" && parsedType !== "number" && parsedType !== "boolean" && parsedType !== "string") {
    return {
      type: Array.isArray(def.value) ? "array" : "object"
    };
  }
  if (refs.target === "openApi3") {
    return {
      type: parsedType === "bigint" ? "integer" : parsedType,
      enum: [def.value]
    };
  }
  return {
    type: parsedType === "bigint" ? "integer" : parsedType,
    const: def.value
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/string.js
var emojiRegex3 = undefined;
var zodPatterns = {
  cuid: /^[cC][^\s-]{8,}$/,
  cuid2: /^[0-9a-z]+$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
  emoji: () => {
    if (emojiRegex3 === undefined) {
      emojiRegex3 = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
    }
    return emojiRegex3;
  },
  uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
  ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
  base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  nanoid: /^[a-zA-Z0-9_-]{21}$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
};
function parseStringDef(def, refs) {
  const res = {
    type: "string"
  };
  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
          break;
        case "max":
          setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
          break;
        case "email":
          switch (refs.emailStrategy) {
            case "format:email":
              addFormat(res, "email", check.message, refs);
              break;
            case "format:idn-email":
              addFormat(res, "idn-email", check.message, refs);
              break;
            case "pattern:zod":
              addPattern(res, zodPatterns.email, check.message, refs);
              break;
          }
          break;
        case "url":
          addFormat(res, "uri", check.message, refs);
          break;
        case "uuid":
          addFormat(res, "uuid", check.message, refs);
          break;
        case "regex":
          addPattern(res, check.regex, check.message, refs);
          break;
        case "cuid":
          addPattern(res, zodPatterns.cuid, check.message, refs);
          break;
        case "cuid2":
          addPattern(res, zodPatterns.cuid2, check.message, refs);
          break;
        case "startsWith":
          addPattern(res, RegExp(`^${escapeLiteralCheckValue(check.value, refs)}`), check.message, refs);
          break;
        case "endsWith":
          addPattern(res, RegExp(`${escapeLiteralCheckValue(check.value, refs)}$`), check.message, refs);
          break;
        case "datetime":
          addFormat(res, "date-time", check.message, refs);
          break;
        case "date":
          addFormat(res, "date", check.message, refs);
          break;
        case "time":
          addFormat(res, "time", check.message, refs);
          break;
        case "duration":
          addFormat(res, "duration", check.message, refs);
          break;
        case "length":
          setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
          setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
          break;
        case "includes": {
          addPattern(res, RegExp(escapeLiteralCheckValue(check.value, refs)), check.message, refs);
          break;
        }
        case "ip": {
          if (check.version !== "v6") {
            addFormat(res, "ipv4", check.message, refs);
          }
          if (check.version !== "v4") {
            addFormat(res, "ipv6", check.message, refs);
          }
          break;
        }
        case "base64url":
          addPattern(res, zodPatterns.base64url, check.message, refs);
          break;
        case "jwt":
          addPattern(res, zodPatterns.jwt, check.message, refs);
          break;
        case "cidr": {
          if (check.version !== "v6") {
            addPattern(res, zodPatterns.ipv4Cidr, check.message, refs);
          }
          if (check.version !== "v4") {
            addPattern(res, zodPatterns.ipv6Cidr, check.message, refs);
          }
          break;
        }
        case "emoji":
          addPattern(res, zodPatterns.emoji(), check.message, refs);
          break;
        case "ulid": {
          addPattern(res, zodPatterns.ulid, check.message, refs);
          break;
        }
        case "base64": {
          switch (refs.base64Strategy) {
            case "format:binary": {
              addFormat(res, "binary", check.message, refs);
              break;
            }
            case "contentEncoding:base64": {
              setResponseValueAndErrors(res, "contentEncoding", "base64", check.message, refs);
              break;
            }
            case "pattern:zod": {
              addPattern(res, zodPatterns.base64, check.message, refs);
              break;
            }
          }
          break;
        }
        case "nanoid": {
          addPattern(res, zodPatterns.nanoid, check.message, refs);
        }
        case "toLowerCase":
        case "toUpperCase":
        case "trim":
          break;
        default:
          ((_) => {})(check);
      }
    }
  }
  return res;
}
function escapeLiteralCheckValue(literal, refs) {
  return refs.patternStrategy === "escape" ? escapeNonAlphaNumeric(literal) : literal;
}
var ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
function escapeNonAlphaNumeric(source) {
  let result = "";
  for (let i = 0;i < source.length; i++) {
    if (!ALPHA_NUMERIC.has(source[i])) {
      result += "\\";
    }
    result += source[i];
  }
  return result;
}
function addFormat(schema, value, message, refs) {
  if (schema.format || schema.anyOf?.some((x) => x.format)) {
    if (!schema.anyOf) {
      schema.anyOf = [];
    }
    if (schema.format) {
      schema.anyOf.push({
        format: schema.format,
        ...schema.errorMessage && refs.errorMessages && {
          errorMessage: { format: schema.errorMessage.format }
        }
      });
      delete schema.format;
      if (schema.errorMessage) {
        delete schema.errorMessage.format;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }
    schema.anyOf.push({
      format: value,
      ...message && refs.errorMessages && { errorMessage: { format: message } }
    });
  } else {
    setResponseValueAndErrors(schema, "format", value, message, refs);
  }
}
function addPattern(schema, regex, message, refs) {
  if (schema.pattern || schema.allOf?.some((x) => x.pattern)) {
    if (!schema.allOf) {
      schema.allOf = [];
    }
    if (schema.pattern) {
      schema.allOf.push({
        pattern: schema.pattern,
        ...schema.errorMessage && refs.errorMessages && {
          errorMessage: { pattern: schema.errorMessage.pattern }
        }
      });
      delete schema.pattern;
      if (schema.errorMessage) {
        delete schema.errorMessage.pattern;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }
    schema.allOf.push({
      pattern: stringifyRegExpWithFlags(regex, refs),
      ...message && refs.errorMessages && { errorMessage: { pattern: message } }
    });
  } else {
    setResponseValueAndErrors(schema, "pattern", stringifyRegExpWithFlags(regex, refs), message, refs);
  }
}
function stringifyRegExpWithFlags(regex, refs) {
  if (!refs.applyRegexFlags || !regex.flags) {
    return regex.source;
  }
  const flags = {
    i: regex.flags.includes("i"),
    m: regex.flags.includes("m"),
    s: regex.flags.includes("s")
  };
  const source = flags.i ? regex.source.toLowerCase() : regex.source;
  let pattern = "";
  let isEscaped = false;
  let inCharGroup = false;
  let inCharRange = false;
  for (let i = 0;i < source.length; i++) {
    if (isEscaped) {
      pattern += source[i];
      isEscaped = false;
      continue;
    }
    if (flags.i) {
      if (inCharGroup) {
        if (source[i].match(/[a-z]/)) {
          if (inCharRange) {
            pattern += source[i];
            pattern += `${source[i - 2]}-${source[i]}`.toUpperCase();
            inCharRange = false;
          } else if (source[i + 1] === "-" && source[i + 2]?.match(/[a-z]/)) {
            pattern += source[i];
            inCharRange = true;
          } else {
            pattern += `${source[i]}${source[i].toUpperCase()}`;
          }
          continue;
        }
      } else if (source[i].match(/[a-z]/)) {
        pattern += `[${source[i]}${source[i].toUpperCase()}]`;
        continue;
      }
    }
    if (flags.m) {
      if (source[i] === "^") {
        pattern += `(^|(?<=[\r
]))`;
        continue;
      } else if (source[i] === "$") {
        pattern += `($|(?=[\r
]))`;
        continue;
      }
    }
    if (flags.s && source[i] === ".") {
      pattern += inCharGroup ? `${source[i]}\r
` : `[${source[i]}\r
]`;
      continue;
    }
    pattern += source[i];
    if (source[i] === "\\") {
      isEscaped = true;
    } else if (inCharGroup && source[i] === "]") {
      inCharGroup = false;
    } else if (!inCharGroup && source[i] === "[") {
      inCharGroup = true;
    }
  }
  try {
    new RegExp(pattern);
  } catch {
    console.warn(`Could not convert regex pattern at ${refs.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`);
    return regex.source;
  }
  return pattern;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/record.js
function parseRecordDef(def, refs) {
  if (refs.target === "openAi") {
    console.warn("Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.");
  }
  if (refs.target === "openApi3" && def.keyType?._def.typeName === ZodFirstPartyTypeKind2.ZodEnum) {
    return {
      type: "object",
      required: def.keyType._def.values,
      properties: def.keyType._def.values.reduce((acc, key) => ({
        ...acc,
        [key]: parseDef(def.valueType._def, {
          ...refs,
          currentPath: [...refs.currentPath, "properties", key]
        }) ?? {}
      }), {}),
      additionalProperties: refs.rejectedAdditionalProperties
    };
  }
  const schema = {
    type: "object",
    additionalProperties: parseDef(def.valueType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    }) ?? refs.allowedAdditionalProperties
  };
  if (refs.target === "openApi3") {
    return schema;
  }
  if (def.keyType?._def.typeName === ZodFirstPartyTypeKind2.ZodString && def.keyType._def.checks?.length) {
    const { type, ...keyType } = parseStringDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind2.ZodEnum) {
    return {
      ...schema,
      propertyNames: {
        enum: def.keyType._def.values
      }
    };
  } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind2.ZodBranded && def.keyType._def.type._def.typeName === ZodFirstPartyTypeKind2.ZodString && def.keyType._def.type._def.checks?.length) {
    const { type, ...keyType } = parseBrandedDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  }
  return schema;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/map.js
function parseMapDef(def, refs) {
  if (refs.mapStrategy === "record") {
    return parseRecordDef(def, refs);
  }
  const keys = parseDef(def.keyType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "0"]
  }) || {};
  const values = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "1"]
  }) || {};
  return {
    type: "array",
    maxItems: 125,
    items: {
      type: "array",
      items: [keys, values],
      minItems: 2,
      maxItems: 2
    }
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/nativeEnum.js
function parseNativeEnumDef(def) {
  const object = def.values;
  const actualKeys = Object.keys(def.values).filter((key) => {
    return typeof object[object[key]] !== "number";
  });
  const actualValues = actualKeys.map((key) => object[key]);
  const parsedTypes = Array.from(new Set(actualValues.map((values) => typeof values)));
  return {
    type: parsedTypes.length === 1 ? parsedTypes[0] === "string" ? "string" : "number" : ["string", "number"],
    enum: actualValues
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/never.js
function parseNeverDef() {
  return {
    not: {}
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/null.js
function parseNullDef(refs) {
  return refs.target === "openApi3" ? {
    enum: ["null"],
    nullable: true
  } : {
    type: "null"
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/union.js
var primitiveMappings = {
  ZodString: "string",
  ZodNumber: "number",
  ZodBigInt: "integer",
  ZodBoolean: "boolean",
  ZodNull: "null"
};
function parseUnionDef(def, refs) {
  if (refs.target === "openApi3")
    return asAnyOf(def, refs);
  const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
  if (options.every((x) => (x._def.typeName in primitiveMappings) && (!x._def.checks || !x._def.checks.length))) {
    const types = options.reduce((types2, x) => {
      const type = primitiveMappings[x._def.typeName];
      return type && !types2.includes(type) ? [...types2, type] : types2;
    }, []);
    return {
      type: types.length > 1 ? types : types[0]
    };
  } else if (options.every((x) => x._def.typeName === "ZodLiteral" && !x.description)) {
    const types = options.reduce((acc, x) => {
      const type = typeof x._def.value;
      switch (type) {
        case "string":
        case "number":
        case "boolean":
          return [...acc, type];
        case "bigint":
          return [...acc, "integer"];
        case "object":
          if (x._def.value === null)
            return [...acc, "null"];
        case "symbol":
        case "undefined":
        case "function":
        default:
          return acc;
      }
    }, []);
    if (types.length === options.length) {
      const uniqueTypes = types.filter((x, i, a) => a.indexOf(x) === i);
      return {
        type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
        enum: options.reduce((acc, x) => {
          return acc.includes(x._def.value) ? acc : [...acc, x._def.value];
        }, [])
      };
    }
  } else if (options.every((x) => x._def.typeName === "ZodEnum")) {
    return {
      type: "string",
      enum: options.reduce((acc, x) => [
        ...acc,
        ...x._def.values.filter((x2) => !acc.includes(x2))
      ], [])
    };
  }
  return asAnyOf(def, refs);
}
var asAnyOf = (def, refs) => {
  const anyOf = (def.options instanceof Map ? Array.from(def.options.values()) : def.options).map((x, i) => parseDef(x._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", `${i}`]
  })).filter((x) => !!x && (!refs.strictUnions || typeof x === "object" && Object.keys(x).length > 0));
  return anyOf.length ? { anyOf } : undefined;
};

// node_modules/zod-to-json-schema/dist/esm/parsers/nullable.js
function parseNullableDef(def, refs) {
  if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(def.innerType._def.typeName) && (!def.innerType._def.checks || !def.innerType._def.checks.length)) {
    if (refs.target === "openApi3") {
      return {
        type: primitiveMappings[def.innerType._def.typeName],
        nullable: true
      };
    }
    return {
      type: [
        primitiveMappings[def.innerType._def.typeName],
        "null"
      ]
    };
  }
  if (refs.target === "openApi3") {
    const base2 = parseDef(def.innerType._def, {
      ...refs,
      currentPath: [...refs.currentPath]
    });
    if (base2 && "$ref" in base2)
      return { allOf: [base2], nullable: true };
    return base2 && { ...base2, nullable: true };
  }
  const base = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "0"]
  });
  return base && { anyOf: [base, { type: "null" }] };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/number.js
function parseNumberDef(def, refs) {
  const res = {
    type: "number"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "int":
        res.type = "integer";
        addErrorMessage(res, "type", check.message, refs);
        break;
      case "min":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMinimum = true;
          }
          setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
        }
        break;
      case "max":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMaximum = true;
          }
          setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
        }
        break;
      case "multipleOf":
        setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
        break;
    }
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/object.js
function parseObjectDef(def, refs) {
  const forceOptionalIntoNullable = refs.target === "openAi";
  const result = {
    type: "object",
    properties: {}
  };
  const required = [];
  const shape = def.shape();
  for (const propName in shape) {
    let propDef = shape[propName];
    if (propDef === undefined || propDef._def === undefined) {
      continue;
    }
    let propOptional = safeIsOptional(propDef);
    if (propOptional && forceOptionalIntoNullable) {
      if (propDef instanceof ZodOptional2) {
        propDef = propDef._def.innerType;
      }
      if (!propDef.isNullable()) {
        propDef = propDef.nullable();
      }
      propOptional = false;
    }
    const parsedDef = parseDef(propDef._def, {
      ...refs,
      currentPath: [...refs.currentPath, "properties", propName],
      propertyPath: [...refs.currentPath, "properties", propName]
    });
    if (parsedDef === undefined) {
      continue;
    }
    result.properties[propName] = parsedDef;
    if (!propOptional) {
      required.push(propName);
    }
  }
  if (required.length) {
    result.required = required;
  }
  const additionalProperties = decideAdditionalProperties(def, refs);
  if (additionalProperties !== undefined) {
    result.additionalProperties = additionalProperties;
  }
  return result;
}
function decideAdditionalProperties(def, refs) {
  if (def.catchall._def.typeName !== "ZodNever") {
    return parseDef(def.catchall._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    });
  }
  switch (def.unknownKeys) {
    case "passthrough":
      return refs.allowedAdditionalProperties;
    case "strict":
      return refs.rejectedAdditionalProperties;
    case "strip":
      return refs.removeAdditionalStrategy === "strict" ? refs.allowedAdditionalProperties : refs.rejectedAdditionalProperties;
  }
}
function safeIsOptional(schema) {
  try {
    return schema.isOptional();
  } catch {
    return true;
  }
}

// node_modules/zod-to-json-schema/dist/esm/parsers/optional.js
var parseOptionalDef = (def, refs) => {
  if (refs.currentPath.toString() === refs.propertyPath?.toString()) {
    return parseDef(def.innerType._def, refs);
  }
  const innerSchema = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "1"]
  });
  return innerSchema ? {
    anyOf: [
      {
        not: {}
      },
      innerSchema
    ]
  } : {};
};

// node_modules/zod-to-json-schema/dist/esm/parsers/pipeline.js
var parsePipelineDef = (def, refs) => {
  if (refs.pipeStrategy === "input") {
    return parseDef(def.in._def, refs);
  } else if (refs.pipeStrategy === "output") {
    return parseDef(def.out._def, refs);
  }
  const a = parseDef(def.in._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", "0"]
  });
  const b = parseDef(def.out._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", a ? "1" : "0"]
  });
  return {
    allOf: [a, b].filter((x) => x !== undefined)
  };
};

// node_modules/zod-to-json-schema/dist/esm/parsers/promise.js
function parsePromiseDef(def, refs) {
  return parseDef(def.type._def, refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/set.js
function parseSetDef(def, refs) {
  const items = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items"]
  });
  const schema = {
    type: "array",
    uniqueItems: true,
    items
  };
  if (def.minSize) {
    setResponseValueAndErrors(schema, "minItems", def.minSize.value, def.minSize.message, refs);
  }
  if (def.maxSize) {
    setResponseValueAndErrors(schema, "maxItems", def.maxSize.value, def.maxSize.message, refs);
  }
  return schema;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/tuple.js
function parseTupleDef(def, refs) {
  if (def.rest) {
    return {
      type: "array",
      minItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === undefined ? acc : [...acc, x], []),
      additionalItems: parseDef(def.rest._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalItems"]
      })
    };
  } else {
    return {
      type: "array",
      minItems: def.items.length,
      maxItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === undefined ? acc : [...acc, x], [])
    };
  }
}

// node_modules/zod-to-json-schema/dist/esm/parsers/undefined.js
function parseUndefinedDef() {
  return {
    not: {}
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/unknown.js
function parseUnknownDef() {
  return {};
}

// node_modules/zod-to-json-schema/dist/esm/parsers/readonly.js
var parseReadonlyDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};

// node_modules/zod-to-json-schema/dist/esm/selectParser.js
var selectParser = (def, typeName, refs) => {
  switch (typeName) {
    case ZodFirstPartyTypeKind2.ZodString:
      return parseStringDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodNumber:
      return parseNumberDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodObject:
      return parseObjectDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodBigInt:
      return parseBigintDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodBoolean:
      return parseBooleanDef();
    case ZodFirstPartyTypeKind2.ZodDate:
      return parseDateDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodUndefined:
      return parseUndefinedDef();
    case ZodFirstPartyTypeKind2.ZodNull:
      return parseNullDef(refs);
    case ZodFirstPartyTypeKind2.ZodArray:
      return parseArrayDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodUnion:
    case ZodFirstPartyTypeKind2.ZodDiscriminatedUnion:
      return parseUnionDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodIntersection:
      return parseIntersectionDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodTuple:
      return parseTupleDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodRecord:
      return parseRecordDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodLiteral:
      return parseLiteralDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodEnum:
      return parseEnumDef(def);
    case ZodFirstPartyTypeKind2.ZodNativeEnum:
      return parseNativeEnumDef(def);
    case ZodFirstPartyTypeKind2.ZodNullable:
      return parseNullableDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodOptional:
      return parseOptionalDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodMap:
      return parseMapDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodSet:
      return parseSetDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodLazy:
      return () => def.getter()._def;
    case ZodFirstPartyTypeKind2.ZodPromise:
      return parsePromiseDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodNaN:
    case ZodFirstPartyTypeKind2.ZodNever:
      return parseNeverDef();
    case ZodFirstPartyTypeKind2.ZodEffects:
      return parseEffectsDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodAny:
      return parseAnyDef();
    case ZodFirstPartyTypeKind2.ZodUnknown:
      return parseUnknownDef();
    case ZodFirstPartyTypeKind2.ZodDefault:
      return parseDefaultDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodBranded:
      return parseBrandedDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodReadonly:
      return parseReadonlyDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodCatch:
      return parseCatchDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodPipeline:
      return parsePipelineDef(def, refs);
    case ZodFirstPartyTypeKind2.ZodFunction:
    case ZodFirstPartyTypeKind2.ZodVoid:
    case ZodFirstPartyTypeKind2.ZodSymbol:
      return;
    default:
      return ((_) => {
        return;
      })(typeName);
  }
};

// node_modules/zod-to-json-schema/dist/esm/parseDef.js
function parseDef(def, refs, forceResolution = false) {
  const seenItem = refs.seen.get(def);
  if (refs.override) {
    const overrideResult = refs.override?.(def, refs, seenItem, forceResolution);
    if (overrideResult !== ignoreOverride) {
      return overrideResult;
    }
  }
  if (seenItem && !forceResolution) {
    const seenSchema = get$ref(seenItem, refs);
    if (seenSchema !== undefined) {
      return seenSchema;
    }
  }
  const newItem = { def, path: refs.currentPath, jsonSchema: undefined };
  refs.seen.set(def, newItem);
  const jsonSchemaOrGetter = selectParser(def, def.typeName, refs);
  const jsonSchema = typeof jsonSchemaOrGetter === "function" ? parseDef(jsonSchemaOrGetter(), refs) : jsonSchemaOrGetter;
  if (jsonSchema) {
    addMeta(def, refs, jsonSchema);
  }
  if (refs.postProcess) {
    const postProcessResult = refs.postProcess(jsonSchema, def, refs);
    newItem.jsonSchema = jsonSchema;
    return postProcessResult;
  }
  newItem.jsonSchema = jsonSchema;
  return jsonSchema;
}
var get$ref = (item, refs) => {
  switch (refs.$refStrategy) {
    case "root":
      return { $ref: item.path.join("/") };
    case "relative":
      return { $ref: getRelativePath(refs.currentPath, item.path) };
    case "none":
    case "seen": {
      if (item.path.length < refs.currentPath.length && item.path.every((value, index) => refs.currentPath[index] === value)) {
        console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);
        return {};
      }
      return refs.$refStrategy === "seen" ? {} : undefined;
    }
  }
};
var getRelativePath = (pathA, pathB) => {
  let i = 0;
  for (;i < pathA.length && i < pathB.length; i++) {
    if (pathA[i] !== pathB[i])
      break;
  }
  return [(pathA.length - i).toString(), ...pathB.slice(i)].join("/");
};
var addMeta = (def, refs, jsonSchema) => {
  if (def.description) {
    jsonSchema.description = def.description;
    if (refs.markdownDescription) {
      jsonSchema.markdownDescription = def.description;
    }
  }
  return jsonSchema;
};
// node_modules/zod-to-json-schema/dist/esm/zodToJsonSchema.js
var zodToJsonSchema = (schema, options) => {
  const refs = getRefs(options);
  const definitions = typeof options === "object" && options.definitions ? Object.entries(options.definitions).reduce((acc, [name2, schema2]) => ({
    ...acc,
    [name2]: parseDef(schema2._def, {
      ...refs,
      currentPath: [...refs.basePath, refs.definitionPath, name2]
    }, true) ?? {}
  }), {}) : undefined;
  const name = typeof options === "string" ? options : options?.nameStrategy === "title" ? undefined : options?.name;
  const main = parseDef(schema._def, name === undefined ? refs : {
    ...refs,
    currentPath: [...refs.basePath, refs.definitionPath, name]
  }, false) ?? {};
  const title = typeof options === "object" && options.name !== undefined && options.nameStrategy === "title" ? options.name : undefined;
  if (title !== undefined) {
    main.title = title;
  }
  const combined = name === undefined ? definitions ? {
    ...main,
    [refs.definitionPath]: definitions
  } : main : {
    $ref: [
      ...refs.$refStrategy === "relative" ? [] : refs.basePath,
      refs.definitionPath,
      name
    ].join("/"),
    [refs.definitionPath]: {
      ...definitions,
      [name]: main
    }
  };
  if (refs.target === "jsonSchema7") {
    combined.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (refs.target === "jsonSchema2019-09" || refs.target === "openAi") {
    combined.$schema = "https://json-schema.org/draft/2019-09/schema#";
  }
  if (refs.target === "openAi" && (("anyOf" in combined) || ("oneOf" in combined) || ("allOf" in combined) || ("type" in combined) && Array.isArray(combined.type))) {
    console.warn("Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.");
  }
  return combined;
};
// node_modules/@modelcontextprotocol/sdk/dist/esm/server/completable.js
var McpZodTypeKind;
(function(McpZodTypeKind2) {
  McpZodTypeKind2["Completable"] = "McpCompletable";
})(McpZodTypeKind || (McpZodTypeKind = {}));

class Completable extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
Completable.create = (type, params) => {
  return new Completable({
    type,
    typeName: McpZodTypeKind.Completable,
    complete: params.complete,
    ...processCreateParams3(params)
  });
};
function processCreateParams3(params) {
  if (!params)
    return {};
  const { errorMap: errorMap3, invalid_type_error, required_error, description } = params;
  if (errorMap3 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap3)
    return { errorMap: errorMap3, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== undefined ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== undefined ? message : required_error) !== null && _a !== undefined ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== undefined ? message : invalid_type_error) !== null && _b !== undefined ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js
class McpServer {
  constructor(serverInfo, options) {
    this._registeredResources = {};
    this._registeredResourceTemplates = {};
    this._registeredTools = {};
    this._registeredPrompts = {};
    this._toolHandlersInitialized = false;
    this._completionHandlerInitialized = false;
    this._resourceHandlersInitialized = false;
    this._promptHandlersInitialized = false;
    this.server = new Server(serverInfo, options);
  }
  async connect(transport) {
    return await this.server.connect(transport);
  }
  async close() {
    await this.server.close();
  }
  setToolRequestHandlers() {
    if (this._toolHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(ListToolsRequestSchema.shape.method.value);
    this.server.assertCanSetRequestHandler(CallToolRequestSchema.shape.method.value);
    this.server.registerCapabilities({
      tools: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: Object.entries(this._registeredTools).filter(([, tool]) => tool.enabled).map(([name, tool]) => {
        const toolDefinition = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema, {
            strictUnions: true
          }) : EMPTY_OBJECT_JSON_SCHEMA,
          annotations: tool.annotations
        };
        if (tool.outputSchema) {
          toolDefinition.outputSchema = zodToJsonSchema(tool.outputSchema, { strictUnions: true });
        }
        return toolDefinition;
      })
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const tool = this._registeredTools[request.params.name];
      if (!tool) {
        throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
      }
      if (!tool.enabled) {
        throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
      }
      let result;
      if (tool.inputSchema) {
        const parseResult = await tool.inputSchema.safeParseAsync(request.params.arguments);
        if (!parseResult.success) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool ${request.params.name}: ${parseResult.error.message}`);
        }
        const args = parseResult.data;
        const cb = tool.callback;
        try {
          result = await Promise.resolve(cb(args, extra));
        } catch (error) {
          result = {
            content: [
              {
                type: "text",
                text: error instanceof Error ? error.message : String(error)
              }
            ],
            isError: true
          };
        }
      } else {
        const cb = tool.callback;
        try {
          result = await Promise.resolve(cb(extra));
        } catch (error) {
          result = {
            content: [
              {
                type: "text",
                text: error instanceof Error ? error.message : String(error)
              }
            ],
            isError: true
          };
        }
      }
      if (tool.outputSchema) {
        if (!result.structuredContent) {
          throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} has an output schema but no structured content was provided`);
        }
        const parseResult = await tool.outputSchema.safeParseAsync(result.structuredContent);
        if (!parseResult.success) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid structured content for tool ${request.params.name}: ${parseResult.error.message}`);
        }
      }
      return result;
    });
    this._toolHandlersInitialized = true;
  }
  setCompletionRequestHandler() {
    if (this._completionHandlerInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(CompleteRequestSchema.shape.method.value);
    this.server.registerCapabilities({
      completions: {}
    });
    this.server.setRequestHandler(CompleteRequestSchema, async (request) => {
      switch (request.params.ref.type) {
        case "ref/prompt":
          return this.handlePromptCompletion(request, request.params.ref);
        case "ref/resource":
          return this.handleResourceCompletion(request, request.params.ref);
        default:
          throw new McpError(ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
      }
    });
    this._completionHandlerInitialized = true;
  }
  async handlePromptCompletion(request, ref) {
    const prompt = this._registeredPrompts[ref.name];
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} not found`);
    }
    if (!prompt.enabled) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} disabled`);
    }
    if (!prompt.argsSchema) {
      return EMPTY_COMPLETION_RESULT;
    }
    const field = prompt.argsSchema.shape[request.params.argument.name];
    if (!(field instanceof Completable)) {
      return EMPTY_COMPLETION_RESULT;
    }
    const def = field._def;
    const suggestions = await def.complete(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  async handleResourceCompletion(request, ref) {
    const template = Object.values(this._registeredResourceTemplates).find((t) => t.resourceTemplate.uriTemplate.toString() === ref.uri);
    if (!template) {
      if (this._registeredResources[ref.uri]) {
        return EMPTY_COMPLETION_RESULT;
      }
      throw new McpError(ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
    }
    const completer = template.resourceTemplate.completeCallback(request.params.argument.name);
    if (!completer) {
      return EMPTY_COMPLETION_RESULT;
    }
    const suggestions = await completer(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  setResourceRequestHandlers() {
    if (this._resourceHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(ListResourcesRequestSchema.shape.method.value);
    this.server.assertCanSetRequestHandler(ListResourceTemplatesRequestSchema.shape.method.value);
    this.server.assertCanSetRequestHandler(ReadResourceRequestSchema.shape.method.value);
    this.server.registerCapabilities({
      resources: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request, extra) => {
      const resources = Object.entries(this._registeredResources).filter(([_, resource]) => resource.enabled).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        ...resource.metadata
      }));
      const templateResources = [];
      for (const template of Object.values(this._registeredResourceTemplates)) {
        if (!template.resourceTemplate.listCallback) {
          continue;
        }
        const result = await template.resourceTemplate.listCallback(extra);
        for (const resource of result.resources) {
          templateResources.push({
            ...template.metadata,
            ...resource
          });
        }
      }
      return { resources: [...resources, ...templateResources] };
    });
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      const resourceTemplates = Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
        name,
        uriTemplate: template.resourceTemplate.uriTemplate.toString(),
        ...template.metadata
      }));
      return { resourceTemplates };
    });
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      const uri = new URL(request.params.uri);
      const resource = this._registeredResources[uri.toString()];
      if (resource) {
        if (!resource.enabled) {
          throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} disabled`);
        }
        return resource.readCallback(uri, extra);
      }
      for (const template of Object.values(this._registeredResourceTemplates)) {
        const variables = template.resourceTemplate.uriTemplate.match(uri.toString());
        if (variables) {
          return template.readCallback(uri, variables, extra);
        }
      }
      throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
    });
    this.setCompletionRequestHandler();
    this._resourceHandlersInitialized = true;
  }
  setPromptRequestHandlers() {
    if (this._promptHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(ListPromptsRequestSchema.shape.method.value);
    this.server.assertCanSetRequestHandler(GetPromptRequestSchema.shape.method.value);
    this.server.registerCapabilities({
      prompts: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListPromptsRequestSchema, () => ({
      prompts: Object.entries(this._registeredPrompts).filter(([, prompt]) => prompt.enabled).map(([name, prompt]) => {
        return {
          name,
          title: prompt.title,
          description: prompt.description,
          arguments: prompt.argsSchema ? promptArgumentsFromSchema(prompt.argsSchema) : undefined
        };
      })
    }));
    this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
      const prompt = this._registeredPrompts[request.params.name];
      if (!prompt) {
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
      }
      if (!prompt.enabled) {
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} disabled`);
      }
      if (prompt.argsSchema) {
        const parseResult = await prompt.argsSchema.safeParseAsync(request.params.arguments);
        if (!parseResult.success) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${parseResult.error.message}`);
        }
        const args = parseResult.data;
        const cb = prompt.callback;
        return await Promise.resolve(cb(args, extra));
      } else {
        const cb = prompt.callback;
        return await Promise.resolve(cb(extra));
      }
    });
    this.setCompletionRequestHandler();
    this._promptHandlersInitialized = true;
  }
  resource(name, uriOrTemplate, ...rest) {
    let metadata;
    if (typeof rest[0] === "object") {
      metadata = rest.shift();
    }
    const readCallback = rest[0];
    if (typeof uriOrTemplate === "string") {
      if (this._registeredResources[uriOrTemplate]) {
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      }
      const registeredResource = this._createRegisteredResource(name, undefined, uriOrTemplate, metadata, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResource;
    } else {
      if (this._registeredResourceTemplates[name]) {
        throw new Error(`Resource template ${name} is already registered`);
      }
      const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, undefined, uriOrTemplate, metadata, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResourceTemplate;
    }
  }
  registerResource(name, uriOrTemplate, config, readCallback) {
    if (typeof uriOrTemplate === "string") {
      if (this._registeredResources[uriOrTemplate]) {
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      }
      const registeredResource = this._createRegisteredResource(name, config.title, uriOrTemplate, config, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResource;
    } else {
      if (this._registeredResourceTemplates[name]) {
        throw new Error(`Resource template ${name} is already registered`);
      }
      const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, config.title, uriOrTemplate, config, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResourceTemplate;
    }
  }
  _createRegisteredResource(name, title, uri, metadata, readCallback) {
    const registeredResource = {
      name,
      title,
      metadata,
      readCallback,
      enabled: true,
      disable: () => registeredResource.update({ enabled: false }),
      enable: () => registeredResource.update({ enabled: true }),
      remove: () => registeredResource.update({ uri: null }),
      update: (updates) => {
        if (typeof updates.uri !== "undefined" && updates.uri !== uri) {
          delete this._registeredResources[uri];
          if (updates.uri)
            this._registeredResources[updates.uri] = registeredResource;
        }
        if (typeof updates.name !== "undefined")
          registeredResource.name = updates.name;
        if (typeof updates.title !== "undefined")
          registeredResource.title = updates.title;
        if (typeof updates.metadata !== "undefined")
          registeredResource.metadata = updates.metadata;
        if (typeof updates.callback !== "undefined")
          registeredResource.readCallback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredResource.enabled = updates.enabled;
        this.sendResourceListChanged();
      }
    };
    this._registeredResources[uri] = registeredResource;
    return registeredResource;
  }
  _createRegisteredResourceTemplate(name, title, template, metadata, readCallback) {
    const registeredResourceTemplate = {
      resourceTemplate: template,
      title,
      metadata,
      readCallback,
      enabled: true,
      disable: () => registeredResourceTemplate.update({ enabled: false }),
      enable: () => registeredResourceTemplate.update({ enabled: true }),
      remove: () => registeredResourceTemplate.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredResourceTemplates[name];
          if (updates.name)
            this._registeredResourceTemplates[updates.name] = registeredResourceTemplate;
        }
        if (typeof updates.title !== "undefined")
          registeredResourceTemplate.title = updates.title;
        if (typeof updates.template !== "undefined")
          registeredResourceTemplate.resourceTemplate = updates.template;
        if (typeof updates.metadata !== "undefined")
          registeredResourceTemplate.metadata = updates.metadata;
        if (typeof updates.callback !== "undefined")
          registeredResourceTemplate.readCallback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredResourceTemplate.enabled = updates.enabled;
        this.sendResourceListChanged();
      }
    };
    this._registeredResourceTemplates[name] = registeredResourceTemplate;
    return registeredResourceTemplate;
  }
  _createRegisteredPrompt(name, title, description, argsSchema, callback) {
    const registeredPrompt = {
      title,
      description,
      argsSchema: argsSchema === undefined ? undefined : z.object(argsSchema),
      callback,
      enabled: true,
      disable: () => registeredPrompt.update({ enabled: false }),
      enable: () => registeredPrompt.update({ enabled: true }),
      remove: () => registeredPrompt.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredPrompts[name];
          if (updates.name)
            this._registeredPrompts[updates.name] = registeredPrompt;
        }
        if (typeof updates.title !== "undefined")
          registeredPrompt.title = updates.title;
        if (typeof updates.description !== "undefined")
          registeredPrompt.description = updates.description;
        if (typeof updates.argsSchema !== "undefined")
          registeredPrompt.argsSchema = z.object(updates.argsSchema);
        if (typeof updates.callback !== "undefined")
          registeredPrompt.callback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredPrompt.enabled = updates.enabled;
        this.sendPromptListChanged();
      }
    };
    this._registeredPrompts[name] = registeredPrompt;
    return registeredPrompt;
  }
  _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, callback) {
    const registeredTool = {
      title,
      description,
      inputSchema: inputSchema === undefined ? undefined : z.object(inputSchema),
      outputSchema: outputSchema === undefined ? undefined : z.object(outputSchema),
      annotations,
      callback,
      enabled: true,
      disable: () => registeredTool.update({ enabled: false }),
      enable: () => registeredTool.update({ enabled: true }),
      remove: () => registeredTool.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredTools[name];
          if (updates.name)
            this._registeredTools[updates.name] = registeredTool;
        }
        if (typeof updates.title !== "undefined")
          registeredTool.title = updates.title;
        if (typeof updates.description !== "undefined")
          registeredTool.description = updates.description;
        if (typeof updates.paramsSchema !== "undefined")
          registeredTool.inputSchema = z.object(updates.paramsSchema);
        if (typeof updates.callback !== "undefined")
          registeredTool.callback = updates.callback;
        if (typeof updates.annotations !== "undefined")
          registeredTool.annotations = updates.annotations;
        if (typeof updates.enabled !== "undefined")
          registeredTool.enabled = updates.enabled;
        this.sendToolListChanged();
      }
    };
    this._registeredTools[name] = registeredTool;
    this.setToolRequestHandlers();
    this.sendToolListChanged();
    return registeredTool;
  }
  tool(name, ...rest) {
    if (this._registeredTools[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    let description;
    let inputSchema;
    let outputSchema;
    let annotations;
    if (typeof rest[0] === "string") {
      description = rest.shift();
    }
    if (rest.length > 1) {
      const firstArg = rest[0];
      if (isZodRawShape(firstArg)) {
        inputSchema = rest.shift();
        if (rest.length > 1 && typeof rest[0] === "object" && rest[0] !== null && !isZodRawShape(rest[0])) {
          annotations = rest.shift();
        }
      } else if (typeof firstArg === "object" && firstArg !== null) {
        annotations = rest.shift();
      }
    }
    const callback = rest[0];
    return this._createRegisteredTool(name, undefined, description, inputSchema, outputSchema, annotations, callback);
  }
  registerTool(name, config, cb) {
    if (this._registeredTools[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    const { title, description, inputSchema, outputSchema, annotations } = config;
    return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, cb);
  }
  prompt(name, ...rest) {
    if (this._registeredPrompts[name]) {
      throw new Error(`Prompt ${name} is already registered`);
    }
    let description;
    if (typeof rest[0] === "string") {
      description = rest.shift();
    }
    let argsSchema;
    if (rest.length > 1) {
      argsSchema = rest.shift();
    }
    const cb = rest[0];
    const registeredPrompt = this._createRegisteredPrompt(name, undefined, description, argsSchema, cb);
    this.setPromptRequestHandlers();
    this.sendPromptListChanged();
    return registeredPrompt;
  }
  registerPrompt(name, config, cb) {
    if (this._registeredPrompts[name]) {
      throw new Error(`Prompt ${name} is already registered`);
    }
    const { title, description, argsSchema } = config;
    const registeredPrompt = this._createRegisteredPrompt(name, title, description, argsSchema, cb);
    this.setPromptRequestHandlers();
    this.sendPromptListChanged();
    return registeredPrompt;
  }
  isConnected() {
    return this.server.transport !== undefined;
  }
  sendResourceListChanged() {
    if (this.isConnected()) {
      this.server.sendResourceListChanged();
    }
  }
  sendToolListChanged() {
    if (this.isConnected()) {
      this.server.sendToolListChanged();
    }
  }
  sendPromptListChanged() {
    if (this.isConnected()) {
      this.server.sendPromptListChanged();
    }
  }
}
var EMPTY_OBJECT_JSON_SCHEMA = {
  type: "object"
};
function isZodRawShape(obj) {
  if (typeof obj !== "object" || obj === null)
    return false;
  const isEmptyObject = Object.keys(obj).length === 0;
  return isEmptyObject || Object.values(obj).some(isZodTypeLike);
}
function isZodTypeLike(value) {
  return value !== null && typeof value === "object" && "parse" in value && typeof value.parse === "function" && "safeParse" in value && typeof value.safeParse === "function";
}
function promptArgumentsFromSchema(schema) {
  return Object.entries(schema.shape).map(([name, field]) => ({
    name,
    description: field.description,
    required: !field.isOptional()
  }));
}
function createCompletionResult(suggestions) {
  return {
    completion: {
      values: suggestions.slice(0, 100),
      total: suggestions.length,
      hasMore: suggestions.length > 100
    }
  };
}
var EMPTY_COMPLETION_RESULT = {
  completion: {
    values: [],
    hasMore: false
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
import process2 from "process";

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/stdio.js
class ReadBuffer {
  append(chunk) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  }
  readMessage() {
    if (!this._buffer) {
      return null;
    }
    const index = this._buffer.indexOf(`
`);
    if (index === -1) {
      return null;
    }
    const line = this._buffer.toString("utf8", 0, index).replace(/\r$/, "");
    this._buffer = this._buffer.subarray(index + 1);
    return deserializeMessage(line);
  }
  clear() {
    this._buffer = undefined;
  }
}
function deserializeMessage(line) {
  return JSONRPCMessageSchema.parse(JSON.parse(line));
}
function serializeMessage(message) {
  return JSON.stringify(message) + `
`;
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
class StdioServerTransport {
  constructor(_stdin = process2.stdin, _stdout = process2.stdout) {
    this._stdin = _stdin;
    this._stdout = _stdout;
    this._readBuffer = new ReadBuffer;
    this._started = false;
    this._ondata = (chunk) => {
      this._readBuffer.append(chunk);
      this.processReadBuffer();
    };
    this._onerror = (error) => {
      var _a;
      (_a = this.onerror) === null || _a === undefined || _a.call(this, error);
    };
  }
  async start() {
    if (this._started) {
      throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }
    this._started = true;
    this._stdin.on("data", this._ondata);
    this._stdin.on("error", this._onerror);
  }
  processReadBuffer() {
    var _a, _b;
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        (_a = this.onmessage) === null || _a === undefined || _a.call(this, message);
      } catch (error) {
        (_b = this.onerror) === null || _b === undefined || _b.call(this, error);
      }
    }
  }
  async close() {
    var _a;
    this._stdin.off("data", this._ondata);
    this._stdin.off("error", this._onerror);
    const remainingDataListeners = this._stdin.listenerCount("data");
    if (remainingDataListeners === 0) {
      this._stdin.pause();
    }
    this._readBuffer.clear();
    (_a = this.onclose) === null || _a === undefined || _a.call(this);
  }
  send(message) {
    return new Promise((resolve) => {
      const json = serializeMessage(message);
      if (this._stdout.write(json)) {
        resolve();
      } else {
        this._stdout.once("drain", resolve);
      }
    });
  }
}

// src/claude_to_figma_mcp/helpers.ts
var logger = {
  info: (message) => process.stderr.write(`[INFO] ${message}
`),
  debug: (message) => process.stderr.write(`[DEBUG] ${message}
`),
  warn: (message) => process.stderr.write(`[WARN] ${message}
`),
  error: (message) => process.stderr.write(`[ERROR] ${message}
`),
  log: (message) => process.stderr.write(`[LOG] ${message}
`)
};
function rgbaToHex(color) {
  if (color.startsWith("#")) {
    return color;
  }
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a === 255 ? "" : a.toString(16).padStart(2, "0")}`;
}
function filterFigmaNode(node) {
  if (node.type === "VECTOR") {
    return null;
  }
  const filtered = {
    id: node.id,
    name: node.name,
    type: node.type
  };
  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill) => {
      const processedFill = { ...fill };
      delete processedFill.boundVariables;
      delete processedFill.imageRef;
      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map((stop) => {
          const processedStop = { ...stop };
          if (processedStop.color) {
            processedStop.color = rgbaToHex(processedStop.color);
          }
          delete processedStop.boundVariables;
          return processedStop;
        });
      }
      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color);
      }
      return processedFill;
    });
  }
  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke) => {
      const processedStroke = { ...stroke };
      delete processedStroke.boundVariables;
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color);
      }
      return processedStroke;
    });
  }
  if (node.cornerRadius !== undefined) {
    filtered.cornerRadius = node.cornerRadius;
  }
  if (node.absoluteBoundingBox) {
    filtered.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if (node.characters) {
    filtered.characters = node.characters;
  }
  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx
    };
  }
  if (node.children) {
    filtered.children = node.children.map((child) => filterFigmaNode(child)).filter((child) => child !== null);
  }
  return filtered;
}

// src/claude_to_figma_mcp/connection.ts
import WebSocket from "ws";

// node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0;i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm/rng.js
import { randomFillSync } from "crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm/native.js
import { randomUUID } from "crypto";
var native_default = { randomUUID };

// node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0;i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;
// src/claude_to_figma_mcp/metrics.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
var MAX_OPERATIONS = 100;
var MIN_CHUNK_SIZE = 5;
var MAX_CHUNK_SIZE = 50;
var RECENT_WINDOW = 20;
var HIGH_FAILURE_THRESHOLD = 0.2;
var LOW_FAILURE_THRESHOLD = 0.05;
var FAST_DURATION_THRESHOLD_MS = 1e4;
var CHUNK_DECREASE_FACTOR = 0.75;
var CHUNK_INCREASE_FACTOR = 1.1;
var TIMEOUT_INCREASE_FACTOR = 1.5;
var METRICS_FILE_PATH = path.join(os.homedir(), ".claude", "cache", "figma-metrics.json");
var cachedStore = null;
function defaultAdaptiveParams() {
  return {
    maxNodesPerChunk: 25,
    maxRetries: 3,
    baseTimeoutMs: 30000,
    retryBackoffMs: 2000,
    lastUpdated: Date.now()
  };
}
function defaultMetricsStore() {
  return {
    operations: [],
    adaptiveParams: defaultAdaptiveParams(),
    commandStats: {}
  };
}
function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE_PATH)) {
      const raw = fs.readFileSync(METRICS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const store2 = {
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
        adaptiveParams: parsed.adaptiveParams ? { ...defaultAdaptiveParams(), ...parsed.adaptiveParams } : defaultAdaptiveParams(),
        commandStats: parsed.commandStats && typeof parsed.commandStats === "object" ? parsed.commandStats : {}
      };
      cachedStore = store2;
      logger.debug(`Loaded metrics: ${store2.operations.length} operations, ${Object.keys(store2.commandStats).length} commands tracked`);
      return store2;
    }
  } catch (err) {
    logger.warn(`Failed to load metrics from ${METRICS_FILE_PATH}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const store = defaultMetricsStore();
  cachedStore = store;
  return store;
}
function saveMetrics(store) {
  try {
    const dir = path.dirname(METRICS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = METRICS_FILE_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmpPath, METRICS_FILE_PATH);
    cachedStore = store;
    logger.debug("Metrics saved to disk");
  } catch (err) {
    logger.error(`Failed to save metrics to ${METRICS_FILE_PATH}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
var lastSaveTime = 0;
var pendingSave = null;
var saveTimer = null;
var SAVE_THROTTLE_MS = 1e4;
function throttledSave(store) {
  const now = Date.now();
  if (now - lastSaveTime >= SAVE_THROTTLE_MS) {
    saveMetrics(store);
    lastSaveTime = now;
    pendingSave = null;
  } else {
    pendingSave = store;
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        if (pendingSave) {
          saveMetrics(pendingSave);
          lastSaveTime = Date.now();
          pendingSave = null;
        }
        saveTimer = null;
      }, SAVE_THROTTLE_MS - (now - lastSaveTime));
    }
  }
}
process.on("beforeExit", () => {
  if (pendingSave) {
    saveMetrics(pendingSave);
    pendingSave = null;
  }
});
function getStore() {
  if (cachedStore === null) {
    return loadMetrics();
  }
  return cachedStore;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function recentOpsForCommand(store, command, limit) {
  const matching = [];
  for (let i = store.operations.length - 1;i >= 0 && matching.length < limit; i--) {
    if (store.operations[i].command === command) {
      matching.push(store.operations[i]);
    }
  }
  return matching;
}
function recordOperation(commandOrRecord, durationMs, success, nodeCount) {
  let record2;
  if (typeof commandOrRecord === "string") {
    record2 = {
      command: commandOrRecord,
      durationMs: durationMs ?? 0,
      success: success ?? true,
      nodeCount: nodeCount ?? 0,
      chunkSize: 0,
      timestamp: Date.now()
    };
  } else {
    record2 = commandOrRecord;
  }
  const store = getStore();
  store.operations.push(record2);
  if (store.operations.length > MAX_OPERATIONS) {
    store.operations = store.operations.slice(store.operations.length - MAX_OPERATIONS);
  }
  const stats = store.commandStats[record2.command] ?? {
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    avgDurationMs: 0
  };
  const prevTotal = stats.totalCalls;
  stats.totalCalls += 1;
  if (record2.success) {
    stats.successCount += 1;
  } else {
    stats.failureCount += 1;
    stats.lastFailureReason = record2.error;
  }
  stats.avgDurationMs = (stats.avgDurationMs * prevTotal + record2.durationMs) / stats.totalCalls;
  store.commandStats[record2.command] = stats;
  const statKeys = Object.keys(store.commandStats);
  if (statKeys.length > 50) {
    const sorted = statKeys.sort((a, b) => (store.commandStats[b].totalCalls || 0) - (store.commandStats[a].totalCalls || 0));
    for (const key of sorted.slice(50)) {
      delete store.commandStats[key];
    }
  }
  adaptParams();
  throttledSave(store);
  logger.debug(`Recorded ${record2.success ? "success" : "failure"} for "${record2.command}" ` + `(${record2.durationMs}ms, ${record2.nodeCount} nodes, chunk ${record2.chunkSize})`);
}
function getAdaptiveParams() {
  const store = getStore();
  const p = store.adaptiveParams;
  return {
    timeoutMs: p.baseTimeoutMs,
    maxRetries: p.maxRetries,
    backoffMs: p.retryBackoffMs,
    maxNodesPerChunk: p.maxNodesPerChunk,
    baseTimeoutMs: p.baseTimeoutMs,
    retryBackoffMs: p.retryBackoffMs,
    lastUpdated: p.lastUpdated
  };
}
function getOptimalChunkSize(command, nodeCount) {
  const store = getStore();
  let chunkSize;
  if (command) {
    const stats = store.commandStats[command];
    if (stats?.optimalChunkSize !== undefined) {
      chunkSize = stats.optimalChunkSize;
    } else {
      chunkSize = store.adaptiveParams.maxNodesPerChunk;
    }
  } else {
    chunkSize = store.adaptiveParams.maxNodesPerChunk;
  }
  const upperBound = nodeCount !== undefined ? Math.min(MAX_CHUNK_SIZE, nodeCount) : MAX_CHUNK_SIZE;
  return clamp(chunkSize, MIN_CHUNK_SIZE, upperBound);
}
function adaptParams() {
  const store = getStore();
  const commandsSeen = new Set;
  for (const op of store.operations) {
    commandsSeen.add(op.command);
  }
  let globalTimeoutBumped = false;
  for (const command of commandsSeen) {
    const recent = recentOpsForCommand(store, command, RECENT_WINDOW);
    if (recent.length < 3) {
      continue;
    }
    const failures = recent.filter((op) => !op.success);
    const failureRate = failures.length / recent.length;
    const timeoutFailures = failures.filter((op) => op.error !== undefined && (op.error.toLowerCase().includes("timeout") || op.error.toLowerCase().includes("timed out")));
    const currentChunk = store.commandStats[command]?.optimalChunkSize ?? store.adaptiveParams.maxNodesPerChunk;
    if (failureRate > HIGH_FAILURE_THRESHOLD) {
      const newChunk = clamp(Math.floor(currentChunk * CHUNK_DECREASE_FACTOR), MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);
      if (newChunk !== currentChunk && store.commandStats[command]) {
        store.commandStats[command].optimalChunkSize = newChunk;
        logger.info(`Adaptive: "${command}" failure rate ${(failureRate * 100).toFixed(0)}% ` + `> ${HIGH_FAILURE_THRESHOLD * 100}% -- chunk size ${currentChunk} -> ${newChunk}`);
      }
    } else if (failureRate < LOW_FAILURE_THRESHOLD) {
      const successfulOps = recent.filter((op) => op.success);
      const avgDuration = successfulOps.reduce((sum, op) => sum + op.durationMs, 0) / (successfulOps.length || 1);
      if (avgDuration < FAST_DURATION_THRESHOLD_MS) {
        const newChunk = clamp(Math.ceil(currentChunk * CHUNK_INCREASE_FACTOR), MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);
        if (newChunk !== currentChunk && store.commandStats[command]) {
          store.commandStats[command].optimalChunkSize = newChunk;
          logger.info(`Adaptive: "${command}" healthy (${(failureRate * 100).toFixed(0)}% fail, ` + `${Math.round(avgDuration)}ms avg) -- chunk size ${currentChunk} -> ${newChunk}`);
        }
      }
    }
    const MAX_TIMEOUT_MS = 120000;
    if (timeoutFailures.length > 0 && !globalTimeoutBumped) {
      const oldTimeout = store.adaptiveParams.baseTimeoutMs;
      store.adaptiveParams.baseTimeoutMs = Math.min(Math.ceil(oldTimeout * TIMEOUT_INCREASE_FACTOR), MAX_TIMEOUT_MS);
      globalTimeoutBumped = true;
      logger.info(`Adaptive: timeout errors detected for "${command}" -- ` + `baseTimeoutMs ${oldTimeout} -> ${store.adaptiveParams.baseTimeoutMs}`);
    }
  }
  if (store.operations.length >= RECENT_WINDOW) {
    const tail = store.operations.slice(-RECENT_WINDOW);
    const globalFailureRate = tail.filter((op) => !op.success).length / tail.length;
    if (globalFailureRate > HIGH_FAILURE_THRESHOLD) {
      const old = store.adaptiveParams.maxNodesPerChunk;
      store.adaptiveParams.maxNodesPerChunk = clamp(Math.floor(old * CHUNK_DECREASE_FACTOR), MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);
      if (store.adaptiveParams.maxNodesPerChunk !== old) {
        logger.info(`Adaptive: global failure rate ${(globalFailureRate * 100).toFixed(0)}% -- ` + `global chunk size ${old} -> ${store.adaptiveParams.maxNodesPerChunk}`);
      }
    } else if (globalFailureRate < LOW_FAILURE_THRESHOLD) {
      const successfulTail = tail.filter((op) => op.success);
      const avgDuration = successfulTail.reduce((sum, op) => sum + op.durationMs, 0) / (successfulTail.length || 1);
      if (avgDuration < FAST_DURATION_THRESHOLD_MS) {
        const old = store.adaptiveParams.maxNodesPerChunk;
        store.adaptiveParams.maxNodesPerChunk = clamp(Math.ceil(old * CHUNK_INCREASE_FACTOR), MIN_CHUNK_SIZE, MAX_CHUNK_SIZE);
        if (store.adaptiveParams.maxNodesPerChunk !== old) {
          logger.info(`Adaptive: global healthy (${(globalFailureRate * 100).toFixed(0)}% fail, ` + `${Math.round(avgDuration)}ms avg) -- global chunk size ${old} -> ${store.adaptiveParams.maxNodesPerChunk}`);
        }
      }
    }
  }
  store.adaptiveParams.lastUpdated = Date.now();
}

// src/claude_to_figma_mcp/events.ts
var MAX_BUFFER_SIZE = 200;
var eventBuffer = [];
var subscribed = false;
function isSubscribed() {
  return subscribed;
}
function setSubscribed(value) {
  subscribed = value;
}
function getBufferSize() {
  return eventBuffer.length;
}
function pushEvent(event) {
  if (!subscribed)
    return;
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    const isHighPriority = (e) => e.eventType !== "nodechange" || e.data?.changes?.some((c) => c.type === "CREATE" || c.type === "DELETE");
    const highPri = eventBuffer.filter(isHighPriority);
    const lowPri = eventBuffer.filter((e) => !isHighPriority(e));
    const highPriKeep = Math.min(highPri.length, MAX_BUFFER_SIZE);
    const lowPriSlots = MAX_BUFFER_SIZE - highPriKeep;
    eventBuffer = [
      ...highPri.slice(-highPriKeep),
      ...lowPri.slice(-Math.max(0, lowPriSlots))
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
}
function pollEvents(options = {}) {
  let matched = [...eventBuffer];
  if (options.eventTypes && options.eventTypes.length > 0) {
    matched = matched.filter((e) => options.eventTypes.includes(e.eventType));
  }
  if (options.since) {
    matched = matched.filter((e) => e.timestamp > options.since);
  }
  if (options.excludePluginOperations) {
    matched = matched.filter((e) => !e.isPluginOperation);
  }
  if (!options.peek) {
    if (!options.eventTypes && !options.since && !options.excludePluginOperations) {
      eventBuffer = [];
    } else {
      const drainSet = new Set(matched);
      eventBuffer = eventBuffer.filter((e) => !drainSet.has(e));
    }
  }
  const result = options.limit ? matched.slice(-options.limit) : matched;
  return result;
}
function onDisconnect() {
  subscribed = false;
}

// src/claude_to_figma_mcp/plugin-runtime.ts
import fs2 from "fs";
import net from "net";
import path2 from "path";
import { spawn } from "child_process";
var PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
var PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA;
var isPluginInstall = Boolean(PLUGIN_ROOT && PLUGIN_DATA);
function figmaPluginManifestPath() {
  return PLUGIN_DATA ? path2.join(PLUGIN_DATA, "figma-plugin", "manifest.json") : null;
}
function installFigmaPluginFiles() {
  if (!PLUGIN_ROOT || !PLUGIN_DATA)
    return;
  const src = path2.join(PLUGIN_ROOT, "figma-plugin");
  const dest = path2.join(PLUGIN_DATA, "figma-plugin");
  try {
    fs2.mkdirSync(dest, { recursive: true });
    for (const file of fs2.readdirSync(src)) {
      fs2.copyFileSync(path2.join(src, file), path2.join(dest, file));
    }
  } catch (error) {
    logger.warn(`Could not copy the Figma plugin files to ${dest}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function isRelayListening(port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
var relayStart = null;
function ensureRelay(port) {
  if (!PLUGIN_ROOT || !PLUGIN_DATA)
    return isRelayListening(port);
  if (!relayStart) {
    relayStart = (async () => {
      if (await isRelayListening(port))
        return true;
      if (!process.versions.bun) {
        logger.error("The relay needs Bun. Install it: curl -fsSL https://bun.sh/install | bash");
        return false;
      }
      const relayScript = path2.join(PLUGIN_ROOT, "server", "relay.js");
      const logPath = path2.join(PLUGIN_DATA, "relay.log");
      fs2.mkdirSync(PLUGIN_DATA, { recursive: true });
      const log = fs2.openSync(logPath, "a");
      const child = spawn(process.execPath, [relayScript], {
        detached: true,
        stdio: ["ignore", log, log]
      });
      child.unref();
      fs2.closeSync(log);
      if (child.pid)
        fs2.writeFileSync(path2.join(PLUGIN_DATA, "relay.pid"), String(child.pid));
      logger.info(`Started relay (pid ${child.pid}); log: ${logPath}`);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (await isRelayListening(port))
          return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      logger.error(`The relay did not start; see ${logPath}`);
      return false;
    })().finally(() => {
      relayStart = null;
    });
  }
  return relayStart;
}

// src/claude_to_figma_mcp/connection.ts
var RELAY_PORT = 3055;
var ws = null;
var pendingRequests = new Map;
var currentChannel = null;
var args = process.argv.slice(2);
var serverArg = args.find((arg) => arg.startsWith("--server="));
var serverUrl = serverArg ? serverArg.split("=")[1] : "localhost";
var WS_URL = serverUrl === "localhost" ? `ws://${serverUrl}` : `wss://${serverUrl}`;
function connectToFigma(port = RELAY_PORT) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const wsUrl = serverUrl === "localhost" ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  ws = new WebSocket(wsUrl);
  ws.on("open", () => {
    logger.info("Connected to Figma socket server");
    currentChannel = null;
  });
  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (json.type === "system" && json.event === "peer_left") {
        if (json.role === "plugin" && json.channel === currentChannel) {
          logger.info(`Figma plugin left channel ${currentChannel}; will auto-join on next command`);
          currentChannel = null;
        }
        return;
      }
      if (json.type === "progress_update") {
        const progressData = json.message.data;
        const requestId = json.id || "";
        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId);
          request.lastActivity = Date.now();
          clearTimeout(request.timeout);
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`);
              pendingRequests.delete(requestId);
              request.reject(new Error("Request to Figma timed out"));
            }
          }, 60000);
          logger.info(`Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`);
          if (progressData.status === "completed" && progressData.progress === 100) {
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`);
          }
        }
        return;
      }
      if (json.type === "event" && json.eventType) {
        pushEvent({
          eventType: json.eventType,
          data: json.data,
          timestamp: json.timestamp || Date.now(),
          receivedAt: Date.now(),
          isPluginOperation: json.isPluginOperation || false
        });
        return;
      }
      const myResponse = json.message;
      if (myResponse.id && pendingRequests.has(myResponse.id) && (myResponse.result !== undefined || myResponse.error)) {
        const request = pendingRequests.get(myResponse.id);
        clearTimeout(request.timeout);
        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new Error(myResponse.error));
        } else {
          request.resolve(myResponse.result);
        }
        pendingRequests.delete(myResponse.id);
      } else {
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ws.on("error", (error) => {
    logger.error(`Socket error: ${error}`);
  });
  ws.on("close", () => {
    logger.info("Disconnected from Figma socket server");
    ws = null;
    onDisconnect();
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }
    logger.info("Attempting to reconnect in 2 seconds...");
    setTimeout(() => connectToFigma(port), 2000);
  });
}
async function joinChannel(channelName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to Figma");
  }
  try {
    await sendCommandToFigma("join", { channel: channelName });
    currentChannel = channelName;
    logger.info(`Joined channel: ${channelName}`);
  } catch (error) {
    logger.error(`Failed to join channel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
async function ensureConnected(timeoutMs = 5000) {
  if (!await ensureRelay(RELAY_PORT)) {
    throw new Error("The relay isn't running on port 3055. Start it with `bun socket` in the claude-to-figma repo.");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ws && ws.readyState === WebSocket.OPEN)
      return;
    connectToFigma();
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Couldn't connect to the relay on port 3055.");
}
function listChannels(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ensureConnected().then(() => listChannels(timeoutMs)).then(resolve, reject);
      return;
    }
    const id = v4_default();
    const timeout = setTimeout(() => {
      if (pendingRequests.delete(id)) {
        reject(new Error("The relay did not answer list_channels. Restart `bun socket` to pick up the current relay."));
      }
    }, timeoutMs);
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now()
    });
    ws.send(JSON.stringify({ id, type: "list_channels" }));
  });
}

class ChannelSelectionError extends Error {
}
var autoJoinInFlight = null;
function autoJoinChannel() {
  if (currentChannel)
    return Promise.resolve(currentChannel);
  if (!autoJoinInFlight) {
    autoJoinInFlight = (async () => {
      const active = await listChannels();
      if (active.length === 0) {
        throw new ChannelSelectionError("No Figma file is connected. In the Figma desktop app, run the Claude to Figma plugin and click Connect.");
      }
      if (active.length > 1) {
        const names = active.map((c) => c.name).join(", ");
        throw new ChannelSelectionError(`Several Figma files are connected (${names}). Call join_channel with the channel shown in the plugin you want.`);
      }
      if (currentChannel)
        return currentChannel;
      await joinChannel(active[0].name);
      return active[0].name;
    })().finally(() => {
      autoJoinInFlight = null;
    });
  }
  return autoJoinInFlight;
}
function sendCommandToFigma(command, params = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!isPluginInstall) {
        connectToFigma();
        reject(new Error("Not connected to the relay. Start it with `bun socket` in the claude-to-figma repo."));
        return;
      }
      ensureConnected().then(() => sendCommandToFigma(command, params, timeoutMs)).then(resolve, reject);
      return;
    }
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      autoJoinChannel().then(() => sendCommandToFigma(command, params, timeoutMs)).then(resolve, reject);
      return;
    }
    const id = v4_default();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...command === "join" ? { channel: params.channel, role: "mcp" } : { channel: currentChannel },
      message: {
        id,
        command,
        params: {
          ...params,
          commandId: id
        }
      }
    };
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`);
        reject(new Error("Request to Figma timed out"));
      }
    }, timeoutMs);
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now()
    });
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}
async function sendCommandWithRetry(command, params = {}, options) {
  const adaptive = getAdaptiveParams();
  const timeoutMs = options?.timeoutMs ?? adaptive.timeoutMs;
  const maxRetries = options?.maxRetries ?? adaptive.maxRetries;
  const backoffMs = options?.backoffMs ?? adaptive.backoffMs;
  let lastError;
  for (let attempt = 0;attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const result = await sendCommandToFigma(command, params, timeoutMs);
      const durationMs = Date.now() - startTime;
      recordOperation(command, durationMs, true);
      return result;
    } catch (error) {
      if (error instanceof ChannelSelectionError)
        throw error;
      const durationMs = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));
      recordOperation(command, durationMs, false);
      if (attempt < maxRetries) {
        const waitMs = backoffMs * Math.pow(2, attempt);
        logger.warn(`Command "${command}" failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}. ` + `Retrying in ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        logger.error(`Command "${command}" failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`);
      }
    }
  }
  throw new Error(`Command "${command}" failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message ?? "unknown"}`);
}

// src/claude_to_figma_mcp/tools/document.ts
function registerTools(server, sendCommandToFigma2) {
  server.tool("get_document_info", "Get detailed information about the current Figma document", {}, async () => {
    try {
      const result = await sendCommandToFigma2("get_document_info");
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("get_selection", "Get information about the current selection in Figma", {}, async () => {
    try {
      const result = await sendCommandToFigma2("get_selection");
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("read_my_design", "Get detailed information about the current selection in Figma, including all node details", {}, async () => {
    try {
      const result = await sendCommandToFigma2("read_my_design", {});
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("get_node_info", "Get detailed information about a specific node in Figma", {
    nodeId: z2.string().describe("The ID of the node to get information about")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("get_node_info", { nodeId });
      return {
        content: [{ type: "text", text: JSON.stringify(filterFigmaNode(result)) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("get_nodes_info", "Get detailed information about multiple nodes in Figma", {
    nodeIds: z2.array(z2.string()).describe("Array of node IDs to get information about")
  }, async ({ nodeIds }) => {
    try {
      const results = await Promise.all(nodeIds.map(async (nodeId) => {
        const result = await sendCommandToFigma2("get_node_info", { nodeId });
        return { nodeId, info: result };
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(results.map((result) => filterFigmaNode(result.info))) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/creation.ts
function registerTools2(server, sendCommandToFigma2) {
  server.tool("create_rectangle", "Create a new rectangle in Figma", {
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    width: z2.number().describe("Width of the rectangle"),
    height: z2.number().describe("Height of the rectangle"),
    name: z2.string().optional().describe("Optional name for the rectangle"),
    parentId: z2.string().optional().describe("Optional parent node ID to append the rectangle to")
  }, async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma2("create_rectangle", { x, y, width, height, name: name || "Rectangle", parentId });
      return { content: [{ type: "text", text: `Created rectangle "${JSON.stringify(result)}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating rectangle: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_frame", "Create a new frame in Figma", {
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    width: z2.number().describe("Width of the frame"),
    height: z2.number().describe("Height of the frame"),
    name: z2.string().optional().describe("Optional name for the frame"),
    parentId: z2.string().optional().describe("Optional parent node ID to append the frame to"),
    fillColor: z2.object({
      r: z2.number().min(0).max(1).describe("Red component (0-1)"),
      g: z2.number().min(0).max(1).describe("Green component (0-1)"),
      b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Fill color in RGBA format"),
    strokeColor: z2.object({
      r: z2.number().min(0).max(1).describe("Red component (0-1)"),
      g: z2.number().min(0).max(1).describe("Green component (0-1)"),
      b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Stroke color in RGBA format"),
    strokeWeight: z2.number().positive().optional().describe("Stroke weight"),
    layoutMode: z2.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout mode for the frame"),
    layoutWrap: z2.enum(["NO_WRAP", "WRAP"]).optional().describe("Whether the auto-layout frame wraps its children"),
    paddingTop: z2.number().optional().describe("Top padding for auto-layout frame"),
    paddingRight: z2.number().optional().describe("Right padding for auto-layout frame"),
    paddingBottom: z2.number().optional().describe("Bottom padding for auto-layout frame"),
    paddingLeft: z2.number().optional().describe("Left padding for auto-layout frame"),
    primaryAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment for auto-layout frame. Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
    counterAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment for auto-layout frame"),
    layoutSizingHorizontal: z2.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing mode for auto-layout frame"),
    layoutSizingVertical: z2.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing mode for auto-layout frame"),
    itemSpacing: z2.number().optional().describe("Distance between children in auto-layout frame. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN."),
    itemReverseZIndex: z2.boolean().optional().describe("Override first-on-top stacking. When true, first child renders on top in auto-layout frames.")
  }, async ({ x, y, width, height, name, parentId, fillColor, strokeColor, strokeWeight, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing, itemReverseZIndex }) => {
    try {
      const result = await sendCommandToFigma2("create_frame", {
        x,
        y,
        width,
        height,
        name: name || "Frame",
        parentId,
        fillColor: fillColor || { r: 1, g: 1, b: 1, a: 1 },
        strokeColor,
        strokeWeight,
        layoutMode,
        layoutWrap,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        primaryAxisAlignItems,
        counterAxisAlignItems,
        layoutSizingHorizontal,
        layoutSizingVertical,
        itemSpacing,
        itemReverseZIndex
      });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating frame: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_text", "Create a new text element in Figma", {
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    text: z2.string().describe("Text content"),
    fontSize: z2.number().optional().describe("Font size (default: 14)"),
    fontWeight: z2.number().optional().describe("Font weight (e.g., 400 for Regular, 700 for Bold)"),
    fontColor: z2.object({
      r: z2.number().min(0).max(1).describe("Red component (0-1)"),
      g: z2.number().min(0).max(1).describe("Green component (0-1)"),
      b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Font color in RGBA format"),
    name: z2.string().optional().describe("Semantic layer name for the text node"),
    parentId: z2.string().optional().describe("Optional parent node ID to append the text to"),
    width: z2.number().positive().optional().describe("Fixed width for the text node. When set, textAutoResize is set to HEIGHT so text wraps at this width. Useful for table cells and fixed-width columns.")
  }, async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId, width }) => {
    try {
      const result = await sendCommandToFigma2("create_text", {
        x,
        y,
        text,
        fontSize: fontSize || 14,
        fontWeight: fontWeight || 400,
        fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 },
        name: name || "Text",
        parentId,
        width
      });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created text "${typedResult.name}" with ID: ${typedResult.id}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating text: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_line", "Create a line or arrow between two points in Figma. Uses a vector node with per-vertex stroke caps, so each end can have a different cap (e.g., one end arrow, other end none).", {
    startX: z2.number().describe("X position of the start point"),
    startY: z2.number().describe("Y position of the start point"),
    endX: z2.number().describe("X position of the end point"),
    endY: z2.number().describe("Y position of the end point"),
    strokeWeight: z2.number().positive().optional().describe("Stroke weight (default 2)"),
    strokeColor: z2.union([
      z2.object({
        r: z2.number().min(0).max(1).describe("Red (0-1)"),
        g: z2.number().min(0).max(1).describe("Green (0-1)"),
        b: z2.number().min(0).max(1).describe("Blue (0-1)"),
        a: z2.number().min(0).max(1).optional().describe("Alpha (0-1)")
      }),
      z2.string().describe("Hex color string (e.g. '#FF0000') or variable ref ('$var:Collection/Name')")
    ]).optional().describe("Stroke color as RGBA object, hex string, or variable reference"),
    startCap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Cap style for the start vertex (default NONE)"),
    endCap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Cap style for the end vertex (default NONE)"),
    name: z2.string().optional().describe("Optional name for the line node"),
    parentId: z2.string().optional().describe("Optional parent node ID to append the line to")
  }, async ({ startX, startY, endX, endY, strokeWeight, strokeColor, startCap, endCap, name, parentId }) => {
    try {
      const result = await sendCommandToFigma2("create_line", {
        startX,
        startY,
        endX,
        endY,
        strokeWeight: strokeWeight || 2,
        strokeColor,
        startCap: startCap || "NONE",
        endCap: endCap || "NONE",
        name: name || "Line",
        parentId
      });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created line "${typedResult.name}" with ID: ${typedResult.id}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating line: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_section", "Create a Figma Section node to organize frames on the canvas", {
    name: z2.string().describe("Name for the section"),
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    width: z2.number().describe("Width of the section"),
    height: z2.number().describe("Height of the section"),
    childIds: z2.array(z2.string()).optional().describe("Optional array of node IDs to move into the section")
  }, async ({ name, x, y, width, height, childIds }) => {
    try {
      const result = await sendCommandToFigma2("create_section", { name, x, y, width, height, childIds });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created section "${typedResult.name}" with ID: ${typedResult.id}${typedResult.childCount ? ` containing ${typedResult.childCount} children` : ""}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating section: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/styling.ts
function registerTools3(server, sendCommandToFigma2) {
  server.tool("set_fill_color", "Set the fill color of a node in Figma can be TextNode or FrameNode", {
    nodeId: z2.string().describe("The ID of the node to modify"),
    r: z2.number().min(0).max(1).describe("Red component (0-1)"),
    g: z2.number().min(0).max(1).describe("Green component (0-1)"),
    b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
  }, async ({ nodeId, r, g, b, a }) => {
    try {
      const result = await sendCommandToFigma2("set_fill_color", { nodeId, color: { r, g, b, a: a || 1 } });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set fill color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_stroke_color", "Set the stroke color of a node in Figma", {
    nodeId: z2.string().describe("The ID of the node to modify"),
    r: z2.number().min(0).max(1).describe("Red component (0-1)"),
    g: z2.number().min(0).max(1).describe("Green component (0-1)"),
    b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
    weight: z2.number().positive().optional().describe("Stroke weight")
  }, async ({ nodeId, r, g, b, a, weight }) => {
    try {
      const result = await sendCommandToFigma2("set_stroke_color", { nodeId, color: { r, g, b, a: a || 1 }, weight: weight || 1 });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set stroke color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1}) with weight ${weight || 1}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_corner_radius", "Set the corner radius of a node in Figma", {
    nodeId: z2.string().describe("The ID of the node to modify"),
    radius: z2.number().min(0).describe("Corner radius value"),
    corners: z2.array(z2.boolean()).length(4).optional().describe("Optional array of 4 booleans to specify which corners to round [topLeft, topRight, bottomRight, bottomLeft]")
  }, async ({ nodeId, radius, corners }) => {
    try {
      const result = await sendCommandToFigma2("set_corner_radius", { nodeId, radius, corners });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set corner radius of node "${typedResult.name}" to ${radius}px` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_stroke_dash", "Set stroke dash pattern on a node (solid, dashed, dotted, or custom)", {
    nodeId: z2.string().describe("The ID of the node"),
    dashPattern: z2.array(z2.number()).describe("Dash pattern array. Empty [] for solid, [10, 5] for dashed, [2, 2] for dotted, or custom values")
  }, async ({ nodeId, dashPattern }) => {
    try {
      const result = await sendCommandToFigma2("set_stroke_dash", { nodeId, dashPattern });
      const typedResult = result;
      const patternDesc = dashPattern.length === 0 ? "solid" : `[${dashPattern.join(", ")}]`;
      return { content: [{ type: "text", text: `Set stroke dash pattern of "${typedResult.name}" to ${patternDesc}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke dash: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_stroke_properties", "Set stroke properties (weight, cap, join, align, dashPattern) on a node without requiring a color change", {
    nodeId: z2.string().describe("The ID of the node"),
    weight: z2.number().positive().optional().describe("Stroke weight"),
    cap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap style"),
    join: z2.enum(["MITER", "BEVEL", "ROUND"]).optional().describe("Stroke join style"),
    align: z2.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional().describe("Stroke alignment relative to the node boundary"),
    dashPattern: z2.array(z2.number()).optional().describe("Dash pattern array. Empty [] for solid, [10, 5] for dashed, [2, 2] for dotted")
  }, async ({ nodeId, weight, cap, join: join2, align, dashPattern }) => {
    if (weight === undefined && cap === undefined && join2 === undefined && align === undefined && dashPattern === undefined) {
      return { content: [{ type: "text", text: "Error: At least one stroke property (weight, cap, join, align, dashPattern) must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma2("set_stroke_properties", { nodeId, weight, cap, join: join2, align, dashPattern });
      const typedResult = result;
      const updated = [];
      if (weight !== undefined)
        updated.push(`weight=${typedResult.strokeWeight}`);
      if (cap !== undefined)
        updated.push(`cap=${typedResult.strokeCap}`);
      if (join2 !== undefined)
        updated.push(`join=${typedResult.strokeJoin}`);
      if (align !== undefined)
        updated.push(`align=${typedResult.strokeAlign}`);
      if (dashPattern !== undefined)
        updated.push(`dashPattern=[${typedResult.dashPattern.join(", ")}]`);
      return { content: [{ type: "text", text: `Set stroke properties on "${typedResult.name}": ${updated.join(", ")}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("remove_fill", "Remove all fills from a node (makes it transparent/no-fill)", {
    nodeId: z2.string().describe("The ID of the node to remove fills from")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("remove_fill", { nodeId });
      const typedResult = result;
      return { content: [{ type: "text", text: `Removed all fills from "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing fill: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_text_decoration", "Set text decoration (underline, strikethrough) on a text node", {
    nodeId: z2.string().describe("The ID of the text node"),
    decoration: z2.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).describe("Text decoration type")
  }, async ({ nodeId, decoration }) => {
    try {
      const result = await sendCommandToFigma2("set_text_decoration", { nodeId, decoration });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set text decoration of "${typedResult.name}" to ${decoration}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text decoration: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/layout.ts
function registerTools4(server, sendCommandToFigma2) {
  server.tool("set_layout_mode", "Set the layout mode and wrap behavior of a frame in Figma", {
    nodeId: z2.string().describe("The ID of the frame to modify"),
    layoutMode: z2.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode for the frame"),
    layoutWrap: z2.enum(["NO_WRAP", "WRAP"]).optional().describe("Whether the auto-layout frame wraps its children"),
    itemReverseZIndex: z2.boolean().optional().describe("Override first-on-top stacking. When true, first child renders on top in auto-layout frames.")
  }, async ({ nodeId, layoutMode, layoutWrap, itemReverseZIndex }) => {
    try {
      const result = await sendCommandToFigma2("set_layout_mode", { nodeId, layoutMode, layoutWrap: layoutWrap || "NO_WRAP", itemReverseZIndex });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set layout mode of frame "${typedResult.name}" to ${layoutMode}${layoutWrap ? ` with ${layoutWrap}` : ""}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_padding", "Set padding values for an auto-layout frame in Figma", {
    nodeId: z2.string().describe("The ID of the frame to modify"),
    paddingTop: z2.number().optional().describe("Top padding value"),
    paddingRight: z2.number().optional().describe("Right padding value"),
    paddingBottom: z2.number().optional().describe("Bottom padding value"),
    paddingLeft: z2.number().optional().describe("Left padding value")
  }, async ({ nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft }) => {
    try {
      const result = await sendCommandToFigma2("set_padding", { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft });
      const typedResult = result;
      const paddingMessages = [];
      if (paddingTop !== undefined)
        paddingMessages.push(`top: ${paddingTop}`);
      if (paddingRight !== undefined)
        paddingMessages.push(`right: ${paddingRight}`);
      if (paddingBottom !== undefined)
        paddingMessages.push(`bottom: ${paddingBottom}`);
      if (paddingLeft !== undefined)
        paddingMessages.push(`left: ${paddingLeft}`);
      const paddingText = paddingMessages.length > 0 ? `padding (${paddingMessages.join(", ")})` : "padding";
      return { content: [{ type: "text", text: `Set ${paddingText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting padding: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_axis_align", "Set primary and counter axis alignment for an auto-layout frame in Figma", {
    nodeId: z2.string().describe("The ID of the frame to modify"),
    primaryAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (MIN/MAX = left/right in horizontal, top/bottom in vertical). Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
    counterAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (MIN/MAX = top/bottom in horizontal, left/right in vertical)")
  }, async ({ nodeId, primaryAxisAlignItems, counterAxisAlignItems }) => {
    try {
      const result = await sendCommandToFigma2("set_axis_align", { nodeId, primaryAxisAlignItems, counterAxisAlignItems });
      const typedResult = result;
      const alignMessages = [];
      if (primaryAxisAlignItems !== undefined)
        alignMessages.push(`primary: ${primaryAxisAlignItems}`);
      if (counterAxisAlignItems !== undefined)
        alignMessages.push(`counter: ${counterAxisAlignItems}`);
      const alignText = alignMessages.length > 0 ? `axis alignment (${alignMessages.join(", ")})` : "axis alignment";
      return { content: [{ type: "text", text: `Set ${alignText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting axis alignment: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_layout_sizing", "Set horizontal and vertical sizing modes for an auto-layout frame in Figma", {
    nodeId: z2.string().describe("The ID of the frame to modify"),
    layoutSizingHorizontal: z2.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing mode (HUG for frames/text only, FILL for auto-layout children only)"),
    layoutSizingVertical: z2.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing mode (HUG for frames/text only, FILL for auto-layout children only)")
  }, async ({ nodeId, layoutSizingHorizontal, layoutSizingVertical }) => {
    try {
      const result = await sendCommandToFigma2("set_layout_sizing", { nodeId, layoutSizingHorizontal, layoutSizingVertical });
      const typedResult = result;
      const sizingMessages = [];
      if (layoutSizingHorizontal !== undefined)
        sizingMessages.push(`horizontal: ${layoutSizingHorizontal}`);
      if (layoutSizingVertical !== undefined)
        sizingMessages.push(`vertical: ${layoutSizingVertical}`);
      const sizingText = sizingMessages.length > 0 ? `layout sizing (${sizingMessages.join(", ")})` : "layout sizing";
      return { content: [{ type: "text", text: `Set ${sizingText} for frame "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout sizing: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_item_spacing", "Set distance between children in an auto-layout frame", {
    nodeId: z2.string().describe("The ID of the frame to modify"),
    itemSpacing: z2.number().optional().describe("Distance between children. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN."),
    counterAxisSpacing: z2.number().optional().describe("Distance between wrapped rows/columns. Only works when layoutWrap is set to WRAP.")
  }, async ({ nodeId, itemSpacing, counterAxisSpacing }) => {
    try {
      const params = { nodeId };
      if (itemSpacing !== undefined)
        params.itemSpacing = itemSpacing;
      if (counterAxisSpacing !== undefined)
        params.counterAxisSpacing = counterAxisSpacing;
      const result = await sendCommandToFigma2("set_item_spacing", params);
      const typedResult = result;
      let message = `Updated spacing for frame "${typedResult.name}":`;
      if (itemSpacing !== undefined)
        message += ` itemSpacing=${itemSpacing}`;
      if (counterAxisSpacing !== undefined)
        message += ` counterAxisSpacing=${counterAxisSpacing}`;
      return { content: [{ type: "text", text: message }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting spacing: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("move_node", "Move a node to a new position in Figma", {
    nodeId: z2.string().describe("The ID of the node to move"),
    x: z2.number().describe("New X position"),
    y: z2.number().describe("New Y position")
  }, async ({ nodeId, x, y }) => {
    try {
      const result = await sendCommandToFigma2("move_node", { nodeId, x, y });
      const typedResult = result;
      return { content: [{ type: "text", text: `Moved node "${typedResult.name}" to position (${x}, ${y})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error moving node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("resize_node", "Resize a node in Figma", {
    nodeId: z2.string().describe("The ID of the node to resize"),
    width: z2.number().positive().describe("New width"),
    height: z2.number().positive().describe("New height")
  }, async ({ nodeId, width, height }) => {
    try {
      const result = await sendCommandToFigma2("resize_node", { nodeId, width, height });
      const typedResult = result;
      return { content: [{ type: "text", text: `Resized node "${typedResult.name}" to width ${width} and height ${height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error resizing node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("delete_node", "Delete a node from Figma", {
    nodeId: z2.string().describe("The ID of the node to delete")
  }, async ({ nodeId }) => {
    try {
      await sendCommandToFigma2("delete_node", { nodeId });
      return { content: [{ type: "text", text: `Deleted node with ID: ${nodeId}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("delete_multiple_nodes", "Delete multiple nodes from Figma at once", {
    nodeIds: z2.array(z2.string()).describe("Array of node IDs to delete")
  }, async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma2("delete_multiple_nodes", { nodeIds });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error deleting multiple nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("clone_node", "Clone an existing node in Figma. Works with nodes inside instances \u2014 the clone is placed on the page or into an explicit parentId.", {
    nodeId: z2.string().describe("The ID of the node to clone"),
    x: z2.number().optional().describe("New X position for the clone"),
    y: z2.number().optional().describe("New Y position for the clone"),
    parentId: z2.string().optional().describe("Optional parent node ID to place the clone into. If omitted, uses the source's parent (or the page if inside an instance).")
  }, async ({ nodeId, x, y, parentId }) => {
    try {
      const result = await sendCommandToFigma2("clone_node", { nodeId, x, y, parentId });
      const typedResult = result;
      return { content: [{ type: "text", text: `Cloned node "${typedResult.name}" with new ID: ${typedResult.id}${x !== undefined && y !== undefined ? ` at position (${x}, ${y})` : ""}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error cloning node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("insert_child_at", "Insert a child node at a specific index in a parent frame (useful for ordering in auto-layout)", {
    parentId: z2.string().describe("The ID of the parent frame"),
    childId: z2.string().describe("The ID of the child node to insert"),
    index: z2.number().int().min(0).describe("The index at which to insert the child (0-based)")
  }, async ({ parentId, childId, index }) => {
    try {
      const result = await sendCommandToFigma2("insert_child_at", { parentId, childId, index });
      const typedResult = result;
      return { content: [{ type: "text", text: `Inserted "${typedResult.childName}" at index ${typedResult.index} in "${typedResult.parentName}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error inserting child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("reorder_child", "Move a child node to a different position in its parent's child array", {
    childId: z2.string().describe("The ID of the child node to reorder"),
    index: z2.number().int().min(0).describe("The new index position (0-based)")
  }, async ({ childId, index }) => {
    try {
      const result = await sendCommandToFigma2("reorder_child", { childId, index });
      const typedResult = result;
      return { content: [{ type: "text", text: `Moved "${typedResult.childName}" to index ${typedResult.index} in "${typedResult.parentName}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error reordering child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_clips_content", "Set whether a frame clips its children to the frame boundary. Set to false for overflow-visible patterns like badges floating above cards.", {
    nodeId: z2.string().describe("The ID of the frame node"),
    clipsContent: z2.boolean().describe("Whether to clip children to the frame boundary")
  }, async ({ nodeId, clipsContent }) => {
    try {
      const result = await sendCommandToFigma2("set_clips_content", { nodeId, clipsContent });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set clipsContent of "${typedResult.name}" to ${typedResult.clipsContent}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting clips content: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/text.ts
function registerTools5(server, sendCommandToFigma2) {
  server.tool("set_text_content", "Set the text content of an existing text node in Figma", {
    nodeId: z2.string().describe("The ID of the text node to modify"),
    text: z2.string().describe("New text content")
  }, async ({ nodeId, text }) => {
    try {
      const result = await sendCommandToFigma2("set_text_content", { nodeId, text });
      const typedResult = result;
      return { content: [{ type: "text", text: `Updated text content of node "${typedResult.name}" to "${text}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text content: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("scan_text_nodes", "Scan all text nodes in the selected Figma node", {
    nodeId: z2.string().describe("ID of the node to scan")
  }, async ({ nodeId }) => {
    try {
      const initialStatus = { type: "text", text: "Starting text node scanning. This may take a moment for large designs..." };
      const result = await sendCommandToFigma2("scan_text_nodes", { nodeId, useChunking: true, chunkSize: 10 });
      if (result && typeof result === "object" && "chunks" in result) {
        const typedResult = result;
        const summaryText = `
        Scan completed:
        - Found ${typedResult.totalNodes} text nodes
        - Processed in ${typedResult.chunks} chunks
        `;
        return { content: [initialStatus, { type: "text", text: summaryText }, { type: "text", text: JSON.stringify(typedResult.textNodes, null, 2) }] };
      }
      return { content: [initialStatus, { type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_multiple_text_contents", "Set multiple text contents parallelly in a node", {
    nodeId: z2.string().describe("The ID of the node containing the text nodes to replace"),
    text: z2.array(z2.object({
      nodeId: z2.string().describe("The ID of the text node"),
      text: z2.string().describe("The replacement text")
    })).describe("Array of text node IDs and their replacement texts")
  }, async ({ nodeId, text }) => {
    try {
      if (!text || text.length === 0) {
        return { content: [{ type: "text", text: "No text provided" }] };
      }
      const initialStatus = { type: "text", text: `Starting text replacement for ${text.length} nodes. This will be processed in batches of 5...` };
      let totalProcessed = 0;
      const totalToProcess = text.length;
      const result = await sendCommandToFigma2("set_multiple_text_contents", { nodeId, text });
      const typedResult = result;
      const success = typedResult.replacementsApplied && typedResult.replacementsApplied > 0;
      const progressText = `
      Text replacement completed:
      - ${typedResult.replacementsApplied || 0} of ${totalToProcess} successfully updated
      - ${typedResult.replacementsFailed || 0} failed
      - Processed in ${typedResult.completedInChunks || 1} batches
      `;
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter((item) => !item.success);
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `

Nodes that failed:
${failedResults.map((item) => `- ${item.nodeId}: ${item.error || "Unknown error"}`).join(`
`)}`;
      }
      return { content: [initialStatus, { type: "text", text: progressText + detailedResponse }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting multiple text contents: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_font_family", "Set the font family on a text node in Figma", {
    nodeId: z2.string().describe("The ID of the text node"),
    fontFamily: z2.string().describe("Font family name (e.g. 'Inter', 'Roboto', 'SF Pro')"),
    fontStyle: z2.string().optional().describe("Font style (e.g. 'Regular', 'Bold', 'Italic'). Defaults to 'Regular'")
  }, async ({ nodeId, fontFamily, fontStyle }) => {
    try {
      const result = await sendCommandToFigma2("set_font_family", { nodeId, fontFamily, fontStyle: fontStyle || "Regular" });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set font family of "${typedResult.name}" to ${typedResult.fontFamily} ${typedResult.fontStyle}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting font family: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_text_auto_resize", "Set text auto-resize mode on a text node to control text wrapping behavior", {
    nodeId: z2.string().describe("The ID of the text node"),
    textAutoResize: z2.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).describe("Auto-resize mode: NONE (fixed size), WIDTH_AND_HEIGHT (auto size), HEIGHT (fixed width, auto height), TRUNCATE (fixed size with truncation)")
  }, async ({ nodeId, textAutoResize }) => {
    try {
      const result = await sendCommandToFigma2("set_text_auto_resize", { nodeId, textAutoResize });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set text auto-resize of "${typedResult.name}" to ${textAutoResize}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text auto-resize: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_text_align", "Set horizontal and/or vertical text alignment on a text node", {
    nodeId: z2.string().describe("The ID of the text node"),
    horizontal: z2.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal text alignment"),
    vertical: z2.enum(["TOP", "CENTER", "BOTTOM"]).optional().describe("Vertical text alignment")
  }, async ({ nodeId, horizontal, vertical }) => {
    if (horizontal === undefined && vertical === undefined) {
      return { content: [{ type: "text", text: "Error: At least one of horizontal or vertical alignment must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma2("set_text_align", { nodeId, horizontal, vertical });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set text alignment of "${typedResult.name}" to horizontal=${typedResult.textAlignHorizontal}, vertical=${typedResult.textAlignVertical}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text alignment: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_text_format", "Set node-level text formatting: line height, paragraph indent/spacing, letter spacing, text case, leading trim, hanging punctuation/list, list spacing, truncation, and max lines.", {
    nodeId: z2.string().describe("The ID of the text node"),
    lineHeight: z2.union([z2.number(), z2.literal("AUTO")]).optional().describe("Line height in pixels, or 'AUTO' for automatic"),
    paragraphIndent: z2.number().min(0).optional().describe("First-line paragraph indent in pixels"),
    paragraphSpacing: z2.number().min(0).optional().describe("Spacing between paragraphs in pixels"),
    letterSpacing: z2.number().optional().describe("Letter spacing in pixels"),
    textCase: z2.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS", "SMALL_CAPS_FORCED"]).optional().describe("Text case transformation"),
    leadingTrim: z2.enum(["NONE", "CAP_HEIGHT"]).optional().describe("Remove vertical space above/below glyphs"),
    hangingPunctuation: z2.boolean().optional().describe("Whether punctuation hangs outside the text box"),
    hangingList: z2.boolean().optional().describe("Whether list bullets/numbers hang outside the text box"),
    listSpacing: z2.number().min(0).optional().describe("Vertical distance between list items in pixels"),
    textTruncation: z2.enum(["DISABLED", "ENDING"]).optional().describe("Whether text truncates with ellipsis"),
    maxLines: z2.number().int().min(1).nullable().optional().describe("Max lines before truncation (null for unlimited)")
  }, async ({ nodeId, lineHeight, paragraphIndent, paragraphSpacing, letterSpacing, textCase, leadingTrim, hangingPunctuation, hangingList, listSpacing, textTruncation, maxLines }) => {
    try {
      const result = await sendCommandToFigma2("set_text_format", { nodeId, lineHeight, paragraphIndent, paragraphSpacing, letterSpacing, textCase, leadingTrim, hangingPunctuation, hangingList, listSpacing, textTruncation, maxLines });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text format: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_text_list", "Set native Figma list formatting (ordered/unordered) on a text node. Can apply to the entire node or to specific lines. Figma renders proper bullets/numbers with correct indentation on wrap.", {
    nodeId: z2.string().describe("The ID of the text node"),
    listType: z2.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type to apply to entire text (default UNORDERED). Ignored if lines array is provided."),
    indentation: z2.number().int().min(0).optional().describe("Indentation level for entire text (0 = top level, 1+ = nested)"),
    listSpacing: z2.number().min(0).optional().describe("Vertical distance between list items in pixels"),
    hangingList: z2.boolean().optional().describe("Whether bullets/numbers hang outside the text box"),
    lines: z2.array(z2.object({
      line: z2.number().int().min(0).describe("0-based line index"),
      type: z2.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type for this line"),
      indentation: z2.number().int().min(0).optional().describe("Indentation level (0+ for nesting)")
    })).optional().describe("Per-line list settings. If provided, listType/indentation are used as defaults for lines that don't specify them.")
  }, async ({ nodeId, listType, indentation, listSpacing, hangingList, lines }) => {
    try {
      const result = await sendCommandToFigma2("set_text_list", { nodeId, listType, indentation, listSpacing, hangingList, lines });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text list: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_range_format", "Apply formatting to specific character ranges within a text node. Supports font family/size/style, color, text case, decoration, letter spacing, line height, list type, indentation, and hyperlinks \u2014 all per-range. Use this for rich text: bold words, colored spans, inline links, mixed fonts.", {
    nodeId: z2.string().describe("The ID of the text node"),
    ranges: z2.array(z2.object({
      start: z2.number().int().min(0).describe("Start character index (0-based, inclusive)"),
      end: z2.number().int().min(1).describe("End character index (exclusive)"),
      fontFamily: z2.string().optional().describe("Font family (e.g. 'Inter', 'Roboto')"),
      fontStyle: z2.string().optional().describe("Font style (e.g. 'Regular', 'Bold', 'Italic'). Defaults to 'Regular'"),
      fontSize: z2.number().positive().optional().describe("Font size in pixels"),
      color: z2.union([z2.string(), z2.object({ r: z2.number(), g: z2.number(), b: z2.number(), a: z2.number().optional() })]).optional().describe("Text color as hex string or RGBA object (0-1)"),
      textCase: z2.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS", "SMALL_CAPS_FORCED"]).optional().describe("Text case transformation"),
      textDecoration: z2.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional().describe("Text decoration"),
      letterSpacing: z2.number().optional().describe("Letter spacing in pixels"),
      lineHeight: z2.union([z2.number(), z2.literal("AUTO")]).optional().describe("Line height in pixels or AUTO"),
      listType: z2.enum(["ORDERED", "UNORDERED", "NONE"]).optional().describe("List type for this range"),
      indentation: z2.number().int().min(0).optional().describe("List indentation level"),
      hyperlink: z2.union([z2.object({ type: z2.literal("URL"), value: z2.string() }), z2.null()]).optional().describe("Hyperlink target (null to remove)")
    })).min(1).describe("Array of character ranges with formatting to apply")
  }, async ({ nodeId, ranges }) => {
    try {
      const result = await sendCommandToFigma2("set_range_format", { nodeId, ranges }, 60000);
      const typedResult = result;
      const failed = typedResult.results.filter((r) => !r.success);
      let text = `Range format: ${typedResult.successCount}/${typedResult.totalRanges} succeeded`;
      if (failed.length > 0) {
        text += `

Failed:
${failed.map((r) => `- range ${r.index} [${r.start}-${r.end}]: ${r.error}`).join(`
`)}`;
      }
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting range format: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/components.ts
function registerTools6(server, sendCommandToFigma2) {
  server.tool("get_styles", "Get all styles from the current Figma document", {}, async () => {
    try {
      const result = await sendCommandToFigma2("get_styles");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("get_local_variables", "Get all local variables (design tokens) from the Figma document, organized by collection. Use these variable names with $var:Collection/Name in create_node_tree color fields to bind real Figma variables.", {}, async () => {
    try {
      const result = await sendCommandToFigma2("get_local_variables");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting local variables: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("get_local_components", "Get all local components from the Figma document", {}, async () => {
    try {
      const result = await sendCommandToFigma2("get_local_components");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_component_instance", "Create an instance of a component in Figma. For LOCAL components (from get_local_components), use componentId with the id field. For published LIBRARY components, use componentKey with the publishedKey field. Optionally set component properties and text overrides in the same call.", {
    componentId: z2.string().optional().describe("ID of a local component (use the id field from get_local_components result). Use this for unpublished/local components."),
    componentKey: z2.string().optional().describe("Key of a published library component to instantiate (use the publishedKey field from get_local_components result). Only works for published components."),
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    parentId: z2.string().optional().describe("Optional parent node ID to place the instance into"),
    insertAt: z2.number().int().min(0).optional().describe("Optional child index to insert at (0 = first/top). If omitted, appends as last child."),
    properties: z2.record(z2.string(), z2.union([z2.string(), z2.boolean()])).optional().describe("Component property overrides using key#id pairs (e.g. {'Text#12345': 'Hello', 'Visible#67890': true})"),
    textOverrides: z2.record(z2.string(), z2.string()).optional().describe("Text overrides keyed by child node name (e.g. {'Title': 'My Title', 'Description': 'My desc'}). Walks the instance tree and sets text on matching names.")
  }, async ({ componentId, componentKey, x, y, parentId, insertAt, properties, textOverrides }) => {
    try {
      const result = await sendCommandToFigma2("create_component_instance", { componentId, componentKey, x, y, parentId, insertAt, properties, textOverrides });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component instance: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("get_instance_overrides", "Get all override properties from a selected component instance. These overrides can be applied to other instances, which will swap them to match the source component.", {
    nodeId: z2.string().optional().describe("Optional ID of the component instance to get overrides from. If not provided, currently selected instance will be used.")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("get_instance_overrides", { instanceNodeId: nodeId || null });
      const typedResult = result;
      return { content: [{ type: "text", text: typedResult.success ? `Successfully got instance overrides: ${typedResult.message}` : `Failed to get instance overrides: ${typedResult.message}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error copying instance overrides: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_instance_overrides", "Apply previously copied overrides to selected component instances. Target instances will be swapped to the source component and all copied override properties will be applied.", {
    sourceInstanceId: z2.string().describe("ID of the source component instance"),
    targetNodeIds: z2.array(z2.string()).describe("Array of target instance IDs. Currently selected instances will be used.")
  }, async ({ sourceInstanceId, targetNodeIds }) => {
    try {
      const result = await sendCommandToFigma2("set_instance_overrides", { sourceInstanceId, targetNodeIds: targetNodeIds || [] });
      const typedResult = result;
      if (typedResult.success) {
        const successCount = typedResult.results?.filter((r) => r.success).length || 0;
        return { content: [{ type: "text", text: `Successfully applied ${typedResult.totalCount || 0} overrides to ${successCount} instances.` }] };
      } else {
        return { content: [{ type: "text", text: `Failed to set instance overrides: ${typedResult.message}` }] };
      }
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting instance overrides: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("swap_instance_variant", "Swap a component instance to a different component or variant. The target must be a COMPONENT node. Overrides on the instance are preserved where possible.", {
    nodeId: z2.string().describe("The ID of the INSTANCE node to swap"),
    componentKey: z2.string().describe("The ID of the target COMPONENT node to swap to (use the id field from get_local_components, or a component node ID from get_node_info)")
  }, async ({ nodeId, componentKey }) => {
    try {
      const result = await sendCommandToFigma2("swap_instance_variant", { nodeId, componentKey });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error swapping instance variant: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_component_properties", "Set component property values on a component instance. Properties use key-value pairs where keys include the #id suffix (e.g. 'Text#12345'). Use get_node_info on an instance to see its componentProperties and available property keys. Supports TEXT, BOOLEAN, INSTANCE_SWAP, and VARIANT property types.", {
    nodeId: z2.string().describe("The ID of the INSTANCE node to update"),
    properties: z2.record(z2.string(), z2.union([z2.string(), z2.boolean()])).describe("Key-value pairs of component properties to set. Keys must include the #id suffix (e.g. 'Text#12345': 'Hello', 'Visible#67890': true). For INSTANCE_SWAP, the value is a component ID string.")
  }, async ({ nodeId, properties }) => {
    try {
      const result = await sendCommandToFigma2("set_component_properties", { nodeId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting component properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_component", "Convert an existing frame into a Figma component", {
    nodeId: z2.string().describe("The ID of the frame to convert into a component")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("create_component", { nodeId });
      const typedResult = result;
      return { content: [{ type: "text", text: `Converted frame to component "${typedResult.name}" with ID: ${typedResult.id} and key: ${typedResult.key}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("export_node_as_image", "Export a node as an image from Figma", {
    nodeId: z2.string().describe("The ID of the node to export"),
    format: z2.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format"),
    scale: z2.number().positive().optional().describe("Export scale")
  }, async ({ nodeId, format, scale }) => {
    try {
      const result = await sendCommandToFigma2("export_node_as_image", { nodeId, format: format || "PNG", scale: scale || 1 });
      const typedResult = result;
      return { content: [{ type: "image", data: typedResult.imageData, mimeType: typedResult.mimeType || "image/png" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/vectors.ts
function registerTools7(server, sendCommandToFigma2) {
  server.tool("create_vector", "Create a vector node from SVG path data in Figma. Supports inline strokeColor/strokeWeight/strokeCap to avoid a separate set_stroke_color call.", {
    pathData: z2.string().describe("SVG path data string (the 'd' attribute value)"),
    x: z2.number().describe("X position"),
    y: z2.number().describe("Y position"),
    width: z2.number().describe("Width to scale the vector to"),
    height: z2.number().describe("Height to scale the vector to"),
    name: z2.string().optional().describe("Optional name for the vector node"),
    parentId: z2.string().optional().describe("Optional parent node ID"),
    fillColor: z2.object({
      r: z2.number().min(0).max(1).describe("Red (0-1)"),
      g: z2.number().min(0).max(1).describe("Green (0-1)"),
      b: z2.number().min(0).max(1).describe("Blue (0-1)"),
      a: z2.number().min(0).max(1).optional().describe("Alpha (0-1)")
    }).optional().describe("Fill color in RGBA format"),
    strokeColor: z2.object({
      r: z2.number().min(0).max(1).describe("Red (0-1)"),
      g: z2.number().min(0).max(1).describe("Green (0-1)"),
      b: z2.number().min(0).max(1).describe("Blue (0-1)"),
      a: z2.number().min(0).max(1).optional().describe("Alpha (0-1)")
    }).optional().describe("Stroke color in RGBA format \u2014 eliminates the need for a separate set_stroke_color call"),
    strokeWeight: z2.number().positive().optional().describe("Stroke weight in pixels"),
    strokeCap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap style (e.g., ARROW_EQUILATERAL for arrowheads)")
  }, async ({ pathData, x, y, width, height, name, parentId, fillColor, strokeColor, strokeWeight, strokeCap }) => {
    try {
      const result = await sendCommandToFigma2("create_vector", { pathData, x, y, width, height, name: name || "Vector", parentId, fillColor, strokeColor, strokeWeight, strokeCap });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created vector "${typedResult.name}" with ID: ${typedResult.id}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating vector: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_vector_path", "Update the SVG path data of an existing vector node in place. Avoids the delete-recreate-restroke pattern when changing a line's route (e.g., straight to L-shaped).", {
    nodeId: z2.string().describe("The ID of the vector node to update"),
    pathData: z2.string().describe("New SVG path data string (the 'd' attribute value)"),
    width: z2.number().optional().describe("New width to resize the vector to (required if path changes shape)"),
    height: z2.number().optional().describe("New height to resize the vector to (required if path changes shape)")
  }, async ({ nodeId, pathData, width, height }) => {
    try {
      const result = await sendCommandToFigma2("set_vector_path", { nodeId, pathData, width, height });
      const typedResult = result;
      return { content: [{ type: "text", text: `Updated vector path of "${typedResult.name}" (${typedResult.id}), size: ${typedResult.width}\xD7${typedResult.height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error updating vector path: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("get_vector_network", "Read the vector network (vertices, segments, regions) of a vector node. Returns point positions, stroke caps, tangent handles, and topology. Use this to inspect existing vectors before modifying them.", {
    nodeId: z2.string().describe("The ID of the vector node to read")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("get_vector_network", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error reading vector network: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_vector_network", "Update the vector network of an existing vector node. Set vertices (with optional strokeCap per point), segments (with optional bezier tangents), and regions. Use this for L-shaped routes, adding/removing points, or changing point positions on existing vectors.", {
    nodeId: z2.string().describe("The ID of the vector node to update"),
    vertices: z2.array(z2.object({
      x: z2.number().describe("X position in local vector coordinates"),
      y: z2.number().describe("Y position in local vector coordinates"),
      strokeCap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap at this vertex"),
      cornerRadius: z2.number().optional().describe("Corner radius at this vertex for rounded bends")
    })).describe("Array of vertex positions"),
    segments: z2.array(z2.object({
      start: z2.number().describe("Index of start vertex"),
      end: z2.number().describe("Index of end vertex"),
      tangentStart: z2.object({ x: z2.number(), y: z2.number() }).optional().describe("Bezier tangent handle at start vertex"),
      tangentEnd: z2.object({ x: z2.number(), y: z2.number() }).optional().describe("Bezier tangent handle at end vertex")
    })).describe("Array of segments connecting vertices"),
    regions: z2.array(z2.object({
      windingRule: z2.enum(["NONZERO", "EVENODD"]).optional().describe("Winding rule for fill"),
      loops: z2.array(z2.array(z2.number())).describe("Arrays of segment indices forming closed loops")
    })).optional().describe("Regions for filled shapes (not needed for open paths/lines)")
  }, async ({ nodeId, vertices, segments, regions }) => {
    try {
      const result = await sendCommandToFigma2("set_vector_network", { nodeId, vertices, segments, regions: regions || [] });
      const typedResult = result;
      return { content: [{ type: "text", text: `Updated vector network of "${typedResult.name}" (${typedResult.id}): ${typedResult.vertexCount} vertices, ${typedResult.segmentCount} segments, ${typedResult.regionCount} regions` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error updating vector network: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/batch.ts
function registerTools8(server, sendCommandToFigma2) {
  server.tool("rename_node", "Rename a node's layer name in Figma", {
    nodeId: z2.string().describe("The ID of the node to rename"),
    name: z2.string().describe("The new name for the node")
  }, async ({ nodeId, name }) => {
    try {
      const result = await sendCommandToFigma2("rename_node", { nodeId, name });
      const typedResult = result;
      return { content: [{ type: "text", text: `Renamed node "${typedResult.oldName}" to "${typedResult.newName}" (ID: ${typedResult.id})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("batch_rename", "Rename multiple nodes' layer names in Figma in one call", {
    mappings: z2.array(z2.object({
      nodeId: z2.string().describe("The ID of the node to rename"),
      name: z2.string().describe("The new name for the node")
    })).describe("Array of node ID and name pairs to rename")
  }, async ({ mappings }) => {
    try {
      if (!mappings || mappings.length === 0) {
        return { content: [{ type: "text", text: "No mappings provided" }] };
      }
      const result = await sendCommandToFigma2("batch_rename", { mappings });
      const typedResult = result;
      const failedResults = typedResult.results.filter((item) => !item.success);
      let responseText = `Batch rename completed: ${typedResult.successCount} of ${typedResult.totalRequested} nodes renamed successfully.`;
      if (failedResults.length > 0) {
        responseText += `

Failed nodes:
${failedResults.map((item) => `- ${item.nodeId}: ${item.error}`).join(`
`)}`;
      }
      return { content: [{ type: "text", text: responseText }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch renaming nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("group_nodes", "Group multiple nodes together (like Cmd+G). All nodes must share the same parent.", {
    nodeIds: z2.array(z2.string()).min(1).describe("Array of node IDs to group together"),
    name: z2.string().optional().describe("Optional name for the group")
  }, async ({ nodeIds, name }) => {
    try {
      const result = await sendCommandToFigma2("group_nodes", { nodeIds, name });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created group "${typedResult.name}" (ID: ${typedResult.id}) with ${typedResult.childrenCount} children` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error grouping nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("batch_reparent", "Move multiple nodes into a target frame/group/section. Validates parent is a container type.", {
    nodeIds: z2.array(z2.string()).min(1).describe("Array of node IDs to move"),
    parentId: z2.string().describe("The ID of the target parent (FRAME, GROUP, SECTION, PAGE, or COMPONENT)"),
    index: z2.number().int().min(0).optional().describe("Optional insertion index (0-based). If omitted, nodes are appended.")
  }, async ({ nodeIds, parentId, index }) => {
    try {
      const result = await sendCommandToFigma2("batch_reparent", { nodeIds, parentId, index });
      const typedResult = result;
      const failedResults = typedResult.results.filter((item) => !item.success);
      let responseText = `Batch reparent completed: ${typedResult.successCount} of ${typedResult.totalRequested} nodes moved into "${typedResult.parentName}".`;
      if (failedResults.length > 0) {
        responseText += `

Failed nodes:
${failedResults.map((item) => `- ${item.nodeId}: ${item.error}`).join(`
`)}`;
      }
      return { content: [{ type: "text", text: responseText }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch reparenting nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("batch_set_fill_color", "Set the fill color of multiple nodes at once. Supports RGBA (0-1), hex strings (#RRGGBB), or Figma variable references ($var:Collection/Name). Returns success/failure counts.", {
    nodeIds: z2.array(z2.string()).describe("Array of node IDs to modify"),
    r: z2.number().min(0).max(1).describe("Red component (0-1)"),
    g: z2.number().min(0).max(1).describe("Green component (0-1)"),
    b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
  }, async ({ nodeIds, r, g, b, a }) => {
    try {
      if (!nodeIds || nodeIds.length === 0) {
        return { content: [{ type: "text", text: "No node IDs provided" }] };
      }
      const result = await sendCommandToFigma2("batch_set_fill_color", { nodeIds, color: { r, g, b, a: a || 1 } });
      const typedResult = result;
      return { content: [{ type: "text", text: `Batch set fill color to RGBA(${r}, ${g}, ${b}, ${a || 1}) on ${nodeIds.length} nodes: ${typedResult.successCount} succeeded, ${typedResult.failureCount} failed` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch setting fill color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("batch_clone", "Clone an existing node to multiple positions in one call. Optionally name each clone. Returns array of created clones with their IDs and positions.", {
    sourceId: z2.string().describe("The ID of the node to clone"),
    positions: z2.array(z2.object({
      x: z2.number().describe("X position for this clone"),
      y: z2.number().describe("Y position for this clone")
    })).describe("Array of {x, y} positions for each clone"),
    names: z2.array(z2.string()).optional().describe("Optional array of names for each clone (must match positions length)")
  }, async ({ sourceId, positions, names }) => {
    try {
      if (!positions || positions.length === 0) {
        return { content: [{ type: "text", text: "No positions provided" }] };
      }
      if (names && names.length !== positions.length) {
        return { content: [{ type: "text", text: `Names array length (${names.length}) must match positions array length (${positions.length})` }] };
      }
      const result = await sendCommandToFigma2("batch_clone", { sourceId, positions, names });
      const typedResult = result;
      const cloneList = typedResult.clones.map((c) => `  - "${c.name}" (${c.id}) at (${c.x}, ${c.y})`).join(`
`);
      return { content: [{ type: "text", text: `Cloned node to ${typedResult.successCount} positions (${typedResult.failureCount} failed):
${cloneList}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch cloning: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/annotations.ts
function registerTools9(server, sendCommandToFigma2) {
  server.tool("get_annotations", "Get all annotations in the current document or specific node", {
    nodeId: z2.string().describe("node ID to get annotations for specific node"),
    includeCategories: z2.boolean().optional().default(true).describe("Whether to include category information")
  }, async ({ nodeId, includeCategories }) => {
    try {
      const result = await sendCommandToFigma2("get_annotations", { nodeId, includeCategories });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting annotations: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_annotation", "Create or update an annotation", {
    nodeId: z2.string().describe("The ID of the node to annotate"),
    annotationId: z2.string().optional().describe("The ID of the annotation to update (if updating existing annotation)"),
    labelMarkdown: z2.string().describe("The annotation text in markdown format"),
    categoryId: z2.string().optional().describe("The ID of the annotation category"),
    properties: z2.array(z2.object({ type: z2.string() })).optional().describe("Additional properties for the annotation")
  }, async ({ nodeId, annotationId, labelMarkdown, categoryId, properties }) => {
    try {
      const result = await sendCommandToFigma2("set_annotation", { nodeId, annotationId, labelMarkdown, categoryId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting annotation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_multiple_annotations", "Set multiple annotations parallelly in a node", {
    nodeId: z2.string().describe("The ID of the node containing the elements to annotate"),
    annotations: z2.array(z2.object({
      nodeId: z2.string().describe("The ID of the node to annotate"),
      labelMarkdown: z2.string().describe("The annotation text in markdown format"),
      categoryId: z2.string().optional().describe("The ID of the annotation category"),
      annotationId: z2.string().optional().describe("The ID of the annotation to update (if updating existing annotation)"),
      properties: z2.array(z2.object({ type: z2.string() })).optional().describe("Additional properties for the annotation")
    })).describe("Array of annotations to apply")
  }, async ({ nodeId, annotations }) => {
    try {
      if (!annotations || annotations.length === 0) {
        return { content: [{ type: "text", text: "No annotations provided" }] };
      }
      const initialStatus = { type: "text", text: `Starting annotation process for ${annotations.length} nodes. This will be processed in batches of 5...` };
      let totalProcessed = 0;
      const totalToProcess = annotations.length;
      const result = await sendCommandToFigma2("set_multiple_annotations", { nodeId, annotations });
      const typedResult = result;
      const success = typedResult.annotationsApplied && typedResult.annotationsApplied > 0;
      const progressText = `
      Annotation process completed:
      - ${typedResult.annotationsApplied || 0} of ${totalToProcess} successfully applied
      - ${typedResult.annotationsFailed || 0} failed
      - Processed in ${typedResult.completedInChunks || 1} batches
      `;
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter((item) => !item.success);
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `

Nodes that failed:
${failedResults.map((item) => `- ${item.nodeId}: ${item.error || "Unknown error"}`).join(`
`)}`;
      }
      return { content: [initialStatus, { type: "text", text: progressText + detailedResponse }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting multiple annotations: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("scan_nodes_by_types", "Scan for child nodes with specific types in the selected Figma node", {
    nodeId: z2.string().describe("ID of the node to scan"),
    types: z2.array(z2.string()).describe("Array of node types to find in the child nodes (e.g. ['COMPONENT', 'FRAME'])")
  }, async ({ nodeId, types }) => {
    try {
      const initialStatus = { type: "text", text: `Starting node type scanning for types: ${types.join(", ")}...` };
      const result = await sendCommandToFigma2("scan_nodes_by_types", { nodeId, types });
      if (result && typeof result === "object" && "matchingNodes" in result) {
        const typedResult = result;
        const summaryText = `Scan completed: Found ${typedResult.count} nodes matching types: ${typedResult.searchedTypes.join(", ")}`;
        return { content: [initialStatus, { type: "text", text: summaryText }, { type: "text", text: JSON.stringify(typedResult.matchingNodes, null, 2) }] };
      }
      return { content: [initialStatus, { type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error scanning nodes by types: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/connections.ts
function registerTools10(server, sendCommandToFigma2) {
  server.tool("get_reactions", "Get Figma Prototyping Reactions from multiple nodes. CRITICAL: The output MUST be processed using the 'reaction_to_connector_strategy' prompt IMMEDIATELY to generate parameters for connector lines via the 'create_connections' tool.", {
    nodeIds: z2.array(z2.string()).describe("Array of node IDs to get reactions from")
  }, async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma2("get_reactions", { nodeIds });
      return {
        content: [
          { type: "text", text: JSON.stringify(result) },
          { type: "text", text: "IMPORTANT: You MUST now use the reaction data above and follow the `reaction_to_connector_strategy` prompt to prepare the parameters for the `create_connections` tool call. This is a required next step." }
        ],
        followUp: { type: "prompt", prompt: "reaction_to_connector_strategy" }
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_default_connector", "Set a copied connector node as the default connector", {
    connectorId: z2.string().optional().describe("The ID of the connector node to set as default")
  }, async ({ connectorId }) => {
    try {
      const result = await sendCommandToFigma2("set_default_connector", { connectorId });
      return { content: [{ type: "text", text: `Default connector set: ${JSON.stringify(result)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting default connector: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_connections", "Create connections between nodes using the default connector style", {
    connections: z2.array(z2.object({
      startNodeId: z2.string().describe("ID of the starting node"),
      endNodeId: z2.string().describe("ID of the ending node"),
      text: z2.string().optional().describe("Optional text to display on the connector")
    })).describe("Array of node connections to create")
  }, async ({ connections }) => {
    try {
      if (!connections || connections.length === 0) {
        return { content: [{ type: "text", text: "No connections provided" }] };
      }
      const result = await sendCommandToFigma2("create_connections", { connections });
      return { content: [{ type: "text", text: `Created ${connections.length} connections: ${JSON.stringify(result)}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating connections: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/navigation.ts
function registerTools11(server, sendCommandToFigma2) {
  server.tool("set_focus", "Set focus on a specific node in Figma by selecting it and scrolling viewport to it", {
    nodeId: z2.string().describe("The ID of the node to focus on")
  }, async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma2("set_focus", { nodeId });
      const typedResult = result;
      return { content: [{ type: "text", text: `Focused on node "${typedResult.name}" (ID: ${typedResult.id})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting focus: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_selections", "Set selection to multiple nodes in Figma and scroll viewport to show them", {
    nodeIds: z2.array(z2.string()).describe("Array of node IDs to select")
  }, async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma2("set_selections", { nodeIds });
      const typedResult = result;
      return { content: [{ type: "text", text: `Selected ${typedResult.count} nodes: ${typedResult.selectedNodes.map((node) => `"${node.name}" (${node.id})`).join(", ")}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting selections: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("undo", "Undo the last action(s) in Figma. Use after destructive operations like rasterizing images at wrong sizes, accidental deletions, or batch mutations that produced wrong results.", {
    count: z2.number().int().min(1).max(50).optional().describe("Number of undo steps (default 1, max 50)")
  }, async ({ count }) => {
    try {
      const steps = count || 1;
      await sendCommandToFigma2("undo", { count: steps });
      return { content: [{ type: "text", text: `Undo triggered ${steps} time(s)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error triggering undo: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("redo", "Redo the last undone action(s) in Figma.", {
    count: z2.number().int().min(1).max(50).optional().describe("Number of redo steps (default 1, max 50)")
  }, async ({ count }) => {
    try {
      const steps = count || 1;
      await sendCommandToFigma2("redo", { count: steps });
      return { content: [{ type: "text", text: `Redo triggered ${steps} time(s)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error triggering redo: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("join_channel", "Connect to a Figma file through its plugin channel. Leave channel empty to join the only connected file automatically. Other tools also auto-join, so this is only needed when several files are connected.", {
    channel: z2.string().describe("Channel name shown in the Figma plugin. Empty = auto-join the only connected file").default("")
  }, async ({ channel }) => {
    try {
      const joined = channel ? (await joinChannel(channel), channel) : await autoJoinChannel();
      return { content: [{ type: "text", text: `Successfully joined channel: ${joined}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/node-tree.ts
var ColorObjectSchema = z2.object({
  r: z2.number().min(0).max(1).describe("Red component (0-1)"),
  g: z2.number().min(0).max(1).describe("Green component (0-1)"),
  b: z2.number().min(0).max(1).describe("Blue component (0-1)"),
  a: z2.number().min(0).max(1).optional().describe("Alpha component (0-1)")
});
var ColorSchema = z2.union([
  ColorObjectSchema,
  z2.string().describe("Hex color (#RGB, #RRGGBB, #RRGGBBAA) or Figma variable reference ($var:Collection/TokenName)")
]);
var BaseFrameSchema = z2.object({
  type: z2.literal("frame"),
  x: z2.number().optional().describe("X position (default 0)"),
  y: z2.number().optional().describe("Y position (default 0)"),
  width: z2.number().describe("Width of the frame"),
  height: z2.number().describe("Height of the frame"),
  name: z2.string().optional().describe("Name for the frame"),
  fillColor: ColorSchema.optional().describe("Fill color in RGBA format"),
  strokeColor: ColorSchema.optional().describe("Stroke color in RGBA format"),
  strokeWeight: z2.number().positive().optional().describe("Stroke weight"),
  layoutMode: z2.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
  layoutWrap: z2.enum(["NO_WRAP", "WRAP"]).optional(),
  paddingTop: z2.number().optional(),
  paddingRight: z2.number().optional(),
  paddingBottom: z2.number().optional(),
  paddingLeft: z2.number().optional(),
  primaryAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z2.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z2.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z2.enum(["FIXED", "HUG", "FILL"]).optional(),
  itemSpacing: z2.number().optional(),
  cornerRadius: z2.number().optional().describe("Uniform corner radius"),
  clipsContent: z2.boolean().optional().describe("Clip content that overflows the frame bounds"),
  counterAxisSpacing: z2.number().optional().describe("Spacing between wrapped rows/columns when layoutWrap is WRAP"),
  itemReverseZIndex: z2.boolean().optional().describe("Reverse z-index order (first child on top)"),
  opacity: z2.number().min(0).max(1).optional().describe("Node opacity (0-1)")
});
var TextNodeSchema = z2.object({
  type: z2.literal("text"),
  x: z2.number().optional().describe("X position (default 0)"),
  y: z2.number().optional().describe("Y position (default 0)"),
  text: z2.string().describe("Text content"),
  fontSize: z2.number().optional(),
  fontWeight: z2.number().optional(),
  fontColor: ColorSchema.optional(),
  name: z2.string().optional(),
  width: z2.number().optional().describe("Optional fixed width for the text node"),
  fontFamily: z2.string().optional().describe("Font family name (default: Inter)"),
  fontStyle: z2.string().optional().describe("Font style (default: derived from fontWeight, e.g. 'Bold', 'Medium')"),
  textAlignHorizontal: z2.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
  lineHeight: z2.number().optional().describe("Line height in pixels"),
  letterSpacing: z2.number().optional().describe("Letter spacing in pixels"),
  textCase: z2.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  opacity: z2.number().min(0).max(1).optional().describe("Node opacity (0-1)")
});
var RectangleNodeSchema = z2.object({
  type: z2.literal("rectangle"),
  x: z2.number().optional().describe("X position (default 0)"),
  y: z2.number().optional().describe("Y position (default 0)"),
  width: z2.number().describe("Width"),
  height: z2.number().describe("Height"),
  name: z2.string().optional(),
  fillColor: ColorSchema.optional(),
  strokeColor: ColorSchema.optional(),
  strokeWeight: z2.number().positive().optional(),
  cornerRadius: z2.number().optional().describe("Uniform corner radius"),
  opacity: z2.number().min(0).max(1).optional().describe("Node opacity (0-1)")
});
var VectorNodeSchema = z2.object({
  type: z2.literal("vector"),
  pathData: z2.string().describe("SVG path data string"),
  x: z2.number().optional().describe("X position (default 0)"),
  y: z2.number().optional().describe("Y position (default 0)"),
  width: z2.number().describe("Width"),
  height: z2.number().describe("Height"),
  name: z2.string().optional(),
  fillColor: ColorSchema.optional(),
  strokeColor: ColorSchema.optional().describe("Stroke color \u2014 hex, RGBA, or $var:Collection/Token"),
  strokeWeight: z2.number().positive().optional().describe("Stroke weight (default 1 when strokeColor is set)"),
  strokeCap: z2.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap applied to all vector vertices"),
  strokeDash: z2.array(z2.number()).optional().describe("Dash pattern array, e.g. [10, 5] for dashed, [] for solid"),
  opacity: z2.number().min(0).max(1).optional().describe("Node opacity (0-1)")
});
var RepeatDirectiveSchema = z2.object({
  $repeat: z2.object({
    data: z2.array(z2.union([z2.array(z2.any()), z2.record(z2.any())])).describe("Array of rows. Each row is either an array (use $[0], $[1], ... in template) or an object (use $key in template)."),
    template: z2.lazy(() => NodeTreeSchema).describe("Node template. String values containing $[N] or $key are substituted per row.")
  })
});
var NodeTreeChildSchema = z2.lazy(() => z2.union([NodeTreeSchema, RepeatDirectiveSchema]));
var NodeTreeSchema = z2.discriminatedUnion("type", [
  BaseFrameSchema.extend({
    children: z2.lazy(() => z2.array(NodeTreeChildSchema)).optional()
  }),
  TextNodeSchema,
  RectangleNodeSchema,
  VectorNodeSchema
]);
function countTreeNodes(tree) {
  if (!tree)
    return 0;
  if (tree.$repeat) {
    const dataLength = Array.isArray(tree.$repeat.data) ? tree.$repeat.data.length : 0;
    const templateCount = countTreeNodes(tree.$repeat.template);
    return templateCount * dataLength;
  }
  let count = 1;
  if (tree.type === "frame" && Array.isArray(tree.children)) {
    for (const child of tree.children) {
      count += countTreeNodes(child);
    }
  }
  return count;
}
function splitTreeIntoChunks(tree, maxNodesPerChunk) {
  if (tree.type !== "frame" || !Array.isArray(tree.children) || tree.children.length === 0) {
    return [tree];
  }
  const totalNodes = countTreeNodes(tree);
  if (totalNodes <= maxNodesPerChunk) {
    return [tree];
  }
  const chunks = [];
  let currentChildren = [];
  let currentNodeCount = 1;
  for (const child of tree.children) {
    const childNodeCount = countTreeNodes(child);
    if (childNodeCount > maxNodesPerChunk) {
      logger.warn(`Single child node (${childNodeCount} nodes) exceeds chunk limit (${maxNodesPerChunk}). ` + `Including it unsplit \u2014 consider reducing child complexity.`);
    }
    if (currentNodeCount + childNodeCount > maxNodesPerChunk && currentChildren.length > 0) {
      if (chunks.length === 0) {
        const { children: _, ...rootProps } = tree;
        chunks.push({ ...rootProps, children: currentChildren });
      } else {
        chunks.push({ children: currentChildren });
      }
      currentChildren = [];
      currentNodeCount = 0;
    }
    currentChildren.push(child);
    currentNodeCount += childNodeCount;
  }
  if (currentChildren.length > 0) {
    if (chunks.length === 0) {
      chunks.push(tree);
    } else {
      chunks.push({ children: currentChildren });
    }
  }
  return chunks;
}
function registerTools12(server, sendCommandToFigma2) {
  server.tool("create_node_tree", 'Create an entire node hierarchy in Figma in one call. Accepts a nested JSON tree of frames, text, rectangles, and vectors. Only frames may have children. Features: (1) $repeat directives in children arrays for data-driven repetition: {"$repeat": {"data": [["a","b"]], "template": {"type": "text", "text": "$[0]"}}}. Array rows use $[0],$[1]; object rows use $key. (2) All color fields accept RGBA objects, hex strings ("#3d6daa"), or Figma variable references ("$var:Colors/Primary") which bind as real Figma variables. Call get_styles or get_local_variables first to discover available tokens. Performance: progress updates fire every 5 nodes, resetting the 60s inactivity timeout \u2014 there is no hard node limit. ~30 nodes per call is a soft guideline for simple layouts; data tables and $repeat structures up to ~150+ nodes work reliably. Response includes stats (durationMs, maxDepth, nodesByType) for performance analysis. Sync mode: pass rootId to reconcile an existing tree instead of creating. Matches nodes by name+type, updates changed properties in place, creates new nodes, preserves unmatched existing nodes (or removes them with prune:true). Node IDs are preserved \u2014 prototype connections survive updates. Sync mode limitations: child ordering is not reconciled (existing visual order is preserved); duplicate name+type siblings are matched FIFO.', {
    tree: NodeTreeSchema.describe("The root node of the tree to create or sync"),
    parentId: z2.string().optional().describe("Parent node ID for create mode"),
    rootId: z2.string().optional().describe("Existing root node ID for sync/reconcile mode. When provided, matches existing children by name+type and updates in place instead of creating new nodes. Node IDs are preserved."),
    prune: z2.boolean().optional().describe("In sync mode, remove existing children not present in the spec. Default false (preserve unmatched nodes).")
  }, async ({ tree, parentId, rootId, prune }) => {
    if (rootId && parentId) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot specify both rootId (sync mode) and parentId (create mode). Use rootId for sync/reconciliation or parentId for creating new nodes." }) }] };
    }
    try {
      const nodeCount = countTreeNodes(tree);
      const optimalChunkSize = getOptimalChunkSize();
      if (rootId || nodeCount <= optimalChunkSize) {
        const startTime = Date.now();
        const result = await sendCommandWithRetry("create_node_tree", { tree, parentId, rootId, prune }, { timeoutMs: 60000 });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      }
      logger.info(`Auto-chunking create_node_tree: ${nodeCount} nodes into chunks of ~${optimalChunkSize}`);
      const chunks = splitTreeIntoChunks(tree, optimalChunkSize);
      logger.info(`Split into ${chunks.length} chunks`);
      const allResults = [];
      let createdParentId;
      const overallStart = Date.now();
      for (let i = 0;i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStart = Date.now();
        if (i === 0) {
          const result = await sendCommandWithRetry("create_node_tree", { tree: chunk, parentId }, { timeoutMs: 60000 });
          allResults.push(result);
          if (result && result.id) {
            createdParentId = result.id;
          } else if (result && result.nodeId) {
            createdParentId = result.nodeId;
          }
          if (!createdParentId) {
            logger.warn("Could not extract parent ID from first chunk result; " + "remaining chunks will be skipped");
            break;
          }
        } else {
          const children = chunk.children || [];
          for (const child of children) {
            const result = await sendCommandWithRetry("create_node_tree", { tree: child, parentId: createdParentId }, { timeoutMs: 60000 });
            allResults.push(result);
          }
          const chunkDuration = Date.now() - chunkStart;
          const chunkNodeCount = children.reduce((sum, c) => sum + countTreeNodes(c), 0);
        }
        logger.info(`Chunk ${i + 1}/${chunks.length} completed`);
      }
      const overallDuration = Date.now() - overallStart;
      const aggregated = {
        chunked: true,
        totalChunks: chunks.length,
        totalNodes: nodeCount,
        durationMs: overallDuration,
        parentId: createdParentId,
        chunkResults: allResults
      };
      return {
        content: [{ type: "text", text: JSON.stringify(aggregated) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error creating node tree: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/screenshot.ts
function registerTools13(server, sendCommandToFigma2) {
  server.tool("screenshot_region", "Capture a screenshot of a canvas region by coordinates. Useful for visually verifying sections of large designs (e.g., sitemap swimlanes) without needing a wrapping frame. Returns a PNG image.", {
    x: z2.number().describe("X coordinate of the top-left corner of the region"),
    y: z2.number().describe("Y coordinate of the top-left corner of the region"),
    width: z2.number().positive().describe("Width of the region to capture"),
    height: z2.number().positive().describe("Height of the region to capture"),
    scale: z2.number().positive().optional().describe("Export scale (default 1). Use 0.5 for large regions, 0.25 for very large regions.")
  }, async ({ x, y, width, height, scale }) => {
    try {
      const result = await sendCommandToFigma2("screenshot_region", {
        x,
        y,
        width,
        height,
        scale: scale || 1
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "image",
            data: typedResult.imageData,
            mimeType: typedResult.mimeType || "image/png"
          },
          {
            type: "text",
            text: `Screenshot captured: region (${typedResult.region.x}, ${typedResult.region.y}) ${typedResult.region.width}\xD7${typedResult.region.height} at ${typedResult.scale}x scale`
          }
        ]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error capturing screenshot: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/batch-mutate.ts
var OperationSchema = z2.discriminatedUnion("op", [
  z2.object({
    op: z2.literal("rename"),
    nodeId: z2.string().describe("Node ID"),
    name: z2.string().describe("New name")
  }),
  z2.object({
    op: z2.literal("set_fill"),
    nodeId: z2.string().describe("Node ID"),
    color: z2.object({
      r: z2.number().min(0).max(1),
      g: z2.number().min(0).max(1),
      b: z2.number().min(0).max(1),
      a: z2.number().min(0).max(1).optional()
    }).describe("RGBA color (0-1)")
  }),
  z2.object({
    op: z2.literal("set_stroke"),
    nodeId: z2.string().describe("Node ID"),
    color: z2.object({
      r: z2.number().min(0).max(1),
      g: z2.number().min(0).max(1),
      b: z2.number().min(0).max(1),
      a: z2.number().min(0).max(1).optional()
    }).describe("RGBA color (0-1)"),
    weight: z2.number().positive().optional().describe("Stroke weight")
  }),
  z2.object({
    op: z2.literal("move"),
    nodeId: z2.string().describe("Node ID"),
    x: z2.number().optional().describe("New X position"),
    y: z2.number().optional().describe("New Y position")
  }),
  z2.object({
    op: z2.literal("resize"),
    nodeId: z2.string().describe("Node ID"),
    width: z2.number().positive().describe("New width"),
    height: z2.number().positive().describe("New height")
  }),
  z2.object({
    op: z2.literal("delete"),
    nodeId: z2.string().describe("Node ID")
  }),
  z2.object({
    op: z2.literal("set_text"),
    nodeId: z2.string().describe("Node ID of a TEXT node"),
    text: z2.string().describe("New text content")
  }),
  z2.object({
    op: z2.literal("set_visible"),
    nodeId: z2.string().describe("Node ID"),
    visible: z2.boolean().describe("Whether the node should be visible")
  }),
  z2.object({
    op: z2.literal("set_font"),
    nodeId: z2.string().describe("Node ID of a TEXT node"),
    fontFamily: z2.string().optional().describe("Font family name (default: Inter)"),
    fontStyle: z2.string().optional().describe("Font style (default: Regular)")
  }),
  z2.object({
    op: z2.literal("set_text_align"),
    nodeId: z2.string().describe("Node ID of a TEXT node"),
    horizontal: z2.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal alignment"),
    vertical: z2.enum(["TOP", "CENTER", "BOTTOM"]).optional().describe("Vertical alignment")
  }),
  z2.object({
    op: z2.literal("set_vector_path"),
    nodeId: z2.string().describe("Node ID of a VECTOR node"),
    pathData: z2.string().describe("New SVG path data string"),
    width: z2.number().positive().optional().describe("New width (must pair with height)"),
    height: z2.number().positive().optional().describe("New height (must pair with width)")
  })
]);
function registerTools14(server, sendCommandToFigma2) {
  server.tool("batch_mutate", "Execute multiple mixed operations in a single round-trip. Supports: rename, set_fill, set_stroke, move, resize, delete, set_text, set_visible, set_font, set_text_align, set_vector_path. Operations run sequentially \u2014 later operations can depend on earlier ones. Dramatically reduces MCP call count for bulk updates.", {
    operations: z2.array(OperationSchema).min(1).max(100).describe("Array of operations to execute. Each must have an 'op' field plus operation-specific params.")
  }, async ({ operations }) => {
    try {
      const result = await sendCommandToFigma2("batch_mutate", { operations }, 60000);
      const typedResult = result;
      const failedResults = typedResult.results.filter((r) => !r.success);
      let responseText = `Batch mutate: ${typedResult.successCount}/${typedResult.totalOperations} succeeded`;
      if (failedResults.length > 0) {
        responseText += `

Failed:
${failedResults.map((r) => `- ${r.op} ${r.nodeId}: ${r.error}`).join(`
`)}`;
      }
      return {
        content: [{ type: "text", text: responseText }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error in batch mutate: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/lint.ts
function registerTools15(server, sendCommandToFigma2) {
  server.tool("scan_node_styles", "Walk a frame tree and return style data (fills, strokes, fonts, layout, corner radius, component info) for every descendant in a single round-trip. Use this for design linting \u2014 the result includes a boundVariable flag on each fill/stroke so you can detect hardcoded colors vs token-bound ones. Returns: { rootId, totalNodes, nodes[] }.", {
    nodeId: z2.string().describe("Root node ID to scan"),
    maxDepth: z2.number().int().min(1).max(50).optional().describe("Maximum tree depth to walk (default 10)")
  }, async ({ nodeId, maxDepth }) => {
    try {
      const result = await sendCommandToFigma2("scan_node_styles", { nodeId, maxDepth }, 60000);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error scanning node styles: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/introspect.ts
function registerTools16(server, sendCommandToFigma2) {
  server.tool("introspect", "Discover the full manipulation surface of a component or frame in one call. Returns a flat property map with semantic keys (e.g. 'badge.text', 'header.fill') where each entry describes a text, color, instance, boolean, or component_property that can be changed. Also reports wrapper frames, name collisions, and nesting depth \u2014 use this output to feed set_properties or optimize_structure.", {
    nodeId: z2.string().describe("Root node ID to introspect"),
    maxDepth: z2.number().int().min(1).max(50).optional().describe("Maximum tree depth to walk (default 20)")
  }, async ({ nodeId, maxDepth }) => {
    try {
      const result = await sendCommandToFigma2("introspect_node", { nodeId, maxDepth }, 60000);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error introspecting node: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("set_properties", "Modify multiple properties of a component or frame by semantic key in one call. Pass the property map from introspect (or a subset) along with new values. Supports text, color (hex), instance swap (variant name), boolean (visibility), and component_property changes. Each property is applied independently \u2014 one failure won't abort others.", {
    nodeId: z2.string().describe("Root node ID (same one passed to introspect)"),
    properties: z2.record(z2.string(), z2.union([z2.string(), z2.boolean(), z2.number()])).describe("Map of semantic key \u2192 new value. Keys must match those returned by introspect."),
    propertyMap: z2.record(z2.string(), z2.any()).optional().describe("Optional property map from introspect result. If omitted, introspect is called internally.")
  }, async ({ nodeId, properties, propertyMap }) => {
    try {
      const result = await sendCommandToFigma2("set_properties", { nodeId, properties, propertyMap }, 60000);
      const typedResult = result;
      const failedResults = typedResult.results.filter((r) => !r.success);
      let responseText = `Set properties: ${typedResult.successCount}/${typedResult.totalProperties} succeeded`;
      if (failedResults.length > 0) {
        responseText += `

Failed:
${failedResults.map((r) => `- ${r.key}: ${r.error}`).join(`
`)}`;
      }
      return {
        content: [{ type: "text", text: responseText }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error setting properties: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("design_query", "Query nodes by type, name, component, or property values \u2014 and optionally bulk-update all matches in one call. Replaces the scan \u2192 introspect \u2192 mutate loop. Use select filters to find nodes, update to apply property changes (same keys as set_properties), and includeProperties to get the introspect output for each match.", {
    select: z2.object({
      type: z2.union([z2.string(), z2.array(z2.string())]).optional().describe("Node type(s) to match, e.g. 'TEXT', 'INSTANCE', ['FRAME', 'COMPONENT']"),
      component: z2.string().optional().describe("Match INSTANCE nodes whose main component name contains this string"),
      name: z2.string().optional().describe("Match nodes whose name contains this substring"),
      nameRegex: z2.string().optional().describe("Match nodes whose name matches this regex"),
      parentId: z2.string().optional().describe("Scope search to descendants of this node"),
      where: z2.record(z2.string(), z2.any()).optional().describe("Match nodes where introspect property key has this value"),
      maxDepth: z2.number().int().min(1).max(100).optional().describe("Maximum tree depth to search (default 100)")
    }).refine((s) => s.type || s.component || s.name || s.nameRegex || s.parentId || s.where, { message: "At least one selection filter (type, component, name, nameRegex, parentId, or where) is required" }).describe("Selection criteria"),
    update: z2.record(z2.string(), z2.union([z2.string(), z2.boolean(), z2.number()])).optional().describe("Property changes to apply to each match (semantic keys from introspect)"),
    limit: z2.number().int().min(1).optional().describe("Maximum number of nodes to return/update"),
    includeProperties: z2.boolean().optional().describe("Include full introspect property map for each match")
  }, async ({ select, update, limit, includeProperties }) => {
    try {
      const result = await sendCommandToFigma2("design_query", { select, update, limit, includeProperties }, 120000);
      const typedResult = result;
      let text = `Scanned ${typedResult.totalScanned} nodes, matched ${typedResult.matched}`;
      if (typedResult.updated !== undefined) {
        text += `, updated ${typedResult.updated}`;
        if (typedResult.failed)
          text += ` (${typedResult.failed} failed)`;
      }
      text += `

${JSON.stringify(typedResult.results)}`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error in design_query: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("optimize_structure", "Analyze and optionally restructure a component or frame for more efficient AI manipulation. By default runs in dry-run mode \u2014 reports what it would change without applying. Detects wrapper frames (single-child frames with no visual purpose) and proposes flattening, and identifies text nodes that could be renamed with _ prefix for clarity. Use dryRun: false to apply changes.", {
    nodeId: z2.string().describe("Root node ID to optimize"),
    options: z2.object({
      dryRun: z2.boolean().optional().describe("If true (default), only report changes without applying them"),
      maxDepth: z2.number().int().min(1).max(50).optional().describe("Maximum tree depth to analyze (default 20)"),
      flatten: z2.boolean().optional().describe("Remove wrapper frames (default true)"),
      rename: z2.boolean().optional().describe("Prefix text node names with _ (default true)"),
      exposeProperties: z2.boolean().optional().describe("Report candidates for component property exposure (default false)"),
      extractComponents: z2.boolean().optional().describe("Report repeated subtree patterns (default false, v2)")
    }).optional().describe("Optimization options")
  }, async ({ nodeId, options }) => {
    try {
      const result = await sendCommandToFigma2("optimize_structure", { nodeId, options }, 60000);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error optimizing structure: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/visual.ts
var EffectSchema = z2.object({
  type: z2.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
  visible: z2.boolean().optional().describe("Whether effect is visible (default true)"),
  color: z2.union([
    z2.string(),
    z2.object({ r: z2.number(), g: z2.number(), b: z2.number(), a: z2.number().optional() })
  ]).optional().describe("Shadow color as hex or RGBA (for shadow types only)"),
  offset: z2.object({ x: z2.number(), y: z2.number() }).optional().describe("Shadow offset in pixels (for shadow types only)"),
  radius: z2.number().min(0).optional().describe("Blur radius in pixels"),
  spread: z2.number().optional().describe("Shadow spread in pixels (for shadow types only)"),
  blendMode: z2.string().optional().describe("Blend mode for the effect")
});
function registerTools17(server, sendCommandToFigma2) {
  server.tool("set_effects", "Set effects on a node: drop shadow, inner shadow, layer blur, background blur. Replaces all existing effects. Pass an empty array to clear effects.", {
    nodeId: z2.string().describe("The ID of the node"),
    effects: z2.array(EffectSchema).describe("Array of effects to apply. For shadows: type, color, offset, radius, spread. For blurs: type, radius.")
  }, async ({ nodeId, effects: effects2 }) => {
    try {
      const result = await sendCommandToFigma2("set_effects", { nodeId, effects: effects2 });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set ${typedResult.effectCount} effect(s) on "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting effects: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_opacity", "Set the opacity of a node (0 = fully transparent, 1 = fully opaque)", {
    nodeId: z2.string().describe("The ID of the node"),
    opacity: z2.number().min(0).max(1).describe("Opacity value (0-1)")
  }, async ({ nodeId, opacity }) => {
    try {
      const result = await sendCommandToFigma2("set_opacity", { nodeId, opacity });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set opacity of "${typedResult.name}" to ${typedResult.opacity}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting opacity: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_blend_mode", "Set the blend mode of a node", {
    nodeId: z2.string().describe("The ID of the node"),
    blendMode: z2.enum([
      "PASS_THROUGH",
      "NORMAL",
      "DARKEN",
      "MULTIPLY",
      "LINEAR_BURN",
      "COLOR_BURN",
      "LIGHTEN",
      "SCREEN",
      "LINEAR_DODGE",
      "COLOR_DODGE",
      "OVERLAY",
      "SOFT_LIGHT",
      "HARD_LIGHT",
      "DIFFERENCE",
      "EXCLUSION",
      "HUE",
      "SATURATION",
      "COLOR",
      "LUMINOSITY"
    ]).describe("Blend mode")
  }, async ({ nodeId, blendMode }) => {
    try {
      const result = await sendCommandToFigma2("set_blend_mode", { nodeId, blendMode });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set blend mode of "${typedResult.name}" to ${typedResult.blendMode}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting blend mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_layout_positioning", "Set a child node to absolute or auto positioning within an auto-layout frame. ABSOLUTE is the 'Ignore auto layout' toggle \u2014 the node floats above siblings without affecting flow. Use with set_constraints to pin position.", {
    nodeId: z2.string().describe("The ID of the child node"),
    positioning: z2.enum(["ABSOLUTE", "AUTO"]).describe("ABSOLUTE = ignore auto-layout (float), AUTO = participate in auto-layout flow"),
    constraints: z2.object({
      horizontal: z2.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Horizontal constraint (MIN=left, MAX=right, CENTER, STRETCH, SCALE)"),
      vertical: z2.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Vertical constraint (MIN=top, MAX=bottom, CENTER, STRETCH, SCALE)")
    }).optional().describe("Optional constraints to set when positioning is ABSOLUTE")
  }, async ({ nodeId, positioning, constraints }) => {
    try {
      const result = await sendCommandToFigma2("set_layout_positioning", { nodeId, positioning, constraints });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set layout positioning of "${typedResult.name}" to ${typedResult.layoutPositioning}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting layout positioning: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_rotation", "Set the rotation of a node in degrees", {
    nodeId: z2.string().describe("The ID of the node"),
    rotation: z2.number().min(-180).max(180).describe("Rotation angle in degrees (-180 to 180)")
  }, async ({ nodeId, rotation }) => {
    try {
      const result = await sendCommandToFigma2("set_rotation", { nodeId, rotation });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set rotation of "${typedResult.name}" to ${typedResult.rotation}\xB0` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting rotation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_ellipse", "Create an ellipse (circle or oval) with optional fill color and arc data for arcs/donuts", {
    x: z2.number().optional().describe("X position (default 0)"),
    y: z2.number().optional().describe("Y position (default 0)"),
    width: z2.number().positive().optional().describe("Width (default 100)"),
    height: z2.number().positive().optional().describe("Height (default 100)"),
    name: z2.string().optional().describe("Node name (default 'Ellipse')"),
    parentId: z2.string().optional().describe("Parent node ID"),
    fillColor: z2.union([
      z2.string(),
      z2.object({ r: z2.number(), g: z2.number(), b: z2.number(), a: z2.number().optional() })
    ]).optional().describe("Fill color as hex string or RGBA object"),
    arcData: z2.object({
      startingAngle: z2.number().optional().describe("Starting angle in radians (default 0)"),
      endingAngle: z2.number().optional().describe("Ending angle in radians (default 2\u03C0 for full circle)"),
      innerRadius: z2.number().min(0).max(1).optional().describe("Inner radius ratio 0-1 (0 = filled, >0 = donut)")
    }).optional().describe("Arc data for creating arcs, pies, or donut shapes")
  }, async ({ x, y, width, height, name, parentId, fillColor, arcData }) => {
    try {
      const result = await sendCommandToFigma2("create_ellipse", { x, y, width, height, name, parentId, fillColor, arcData });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating ellipse: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_constraints", "Set horizontal and vertical constraints (pinning) on a node for responsive behavior", {
    nodeId: z2.string().describe("The ID of the node"),
    horizontal: z2.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Horizontal constraint: MIN=pin left, MAX=pin right, CENTER=center, STRETCH=stretch, SCALE=scale"),
    vertical: z2.enum(["MIN", "MAX", "CENTER", "STRETCH", "SCALE"]).optional().describe("Vertical constraint: MIN=pin top, MAX=pin bottom, CENTER=center, STRETCH=stretch, SCALE=scale")
  }, async ({ nodeId, horizontal, vertical }) => {
    if (horizontal === undefined && vertical === undefined) {
      return { content: [{ type: "text", text: "Error: At least one of horizontal or vertical constraint must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma2("set_constraints", { nodeId, horizontal, vertical });
      const typedResult = result;
      return { content: [{ type: "text", text: `Set constraints on "${typedResult.name}" to H=${typedResult.constraints.horizontal}, V=${typedResult.constraints.vertical}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting constraints: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_min_max_size", "Set min/max width and height on a node. Used with auto-layout FILL sizing to constrain how children grow/shrink.", {
    nodeId: z2.string().describe("The ID of the node"),
    minWidth: z2.number().min(0).nullable().optional().describe("Minimum width in pixels (null to clear)"),
    maxWidth: z2.number().min(0).nullable().optional().describe("Maximum width in pixels (null to clear)"),
    minHeight: z2.number().min(0).nullable().optional().describe("Minimum height in pixels (null to clear)"),
    maxHeight: z2.number().min(0).nullable().optional().describe("Maximum height in pixels (null to clear)")
  }, async ({ nodeId, minWidth, maxWidth, minHeight, maxHeight }) => {
    try {
      const result = await sendCommandToFigma2("set_min_max_size", { nodeId, minWidth, maxWidth, minHeight, maxHeight });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting min/max size: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("set_mask", "Set a node as a mask layer \u2014 it clips subsequent siblings to its shape. Optionally group the mask with specified sibling nodes first (best practice to contain the mask effect).", {
    nodeId: z2.string().describe("The ID of the node to use as a mask (typically a shape like rectangle, ellipse, or vector)"),
    isMask: z2.boolean().optional().describe("Whether to enable (true, default) or disable (false) masking"),
    groupWithIds: z2.array(z2.string()).optional().describe("Optional array of sibling node IDs to group with the mask node before applying. Groups the mask + siblings so the mask effect is contained."),
    groupName: z2.string().optional().describe("Optional name for the created group")
  }, async ({ nodeId, isMask, groupWithIds, groupName }) => {
    try {
      const result = await sendCommandToFigma2("set_mask", { nodeId, isMask, groupWithIds, groupName });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting mask: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_svg", "Create Figma nodes from a complete SVG string. Handles multi-path SVGs (logos, icons, illustrations) in one call \u2014 no need to split paths. Returns a frame containing the parsed SVG elements.", {
    svg: z2.string().describe("Complete SVG markup string (e.g. '<svg ...>...</svg>')"),
    name: z2.string().optional().describe("Name for the created frame"),
    x: z2.number().optional().describe("X position"),
    y: z2.number().optional().describe("Y position"),
    width: z2.number().positive().optional().describe("Target width (must set both width and height to resize)"),
    height: z2.number().positive().optional().describe("Target height (must set both width and height to resize)"),
    parentId: z2.string().optional().describe("Parent node ID"),
    insertAt: z2.number().int().min(0).optional().describe("Index to insert at within parent")
  }, async ({ svg, name, x, y, width, height, parentId, insertAt }) => {
    try {
      const result = await sendCommandToFigma2("create_svg", { svg, name, x, y, width, height, parentId, insertAt });
      const typedResult = result;
      return { content: [{ type: "text", text: `Created SVG "${typedResult.name}" (${typedResult.id}) with ${typedResult.childCount} child node(s) at (${typedResult.x}, ${typedResult.y}), size ${typedResult.width}x${typedResult.height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating SVG: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("create_component_set", "Combine multiple component nodes into a component set (variants). Each component becomes a variant. Component names should follow Figma's variant naming convention: 'Property1=Value1, Property2=Value2'. All components must share the same parent.", {
    componentIds: z2.array(z2.string()).min(2).describe("Array of COMPONENT node IDs to combine. Must be at least 2. Use create_component to convert frames first if needed."),
    name: z2.string().optional().describe("Optional name for the component set")
  }, async ({ componentIds, name }) => {
    try {
      const result = await sendCommandToFigma2("create_component_set", { componentIds, name });
      const typedResult = result;
      let text = `Created component set "${typedResult.name}" with ${typedResult.variantCount} variants:
`;
      text += typedResult.variants.map((v) => `- ${v.name} (${v.id})`).join(`
`);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component set: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/eval.ts
function registerTools18(server, sendCommandToFigma2) {
  server.tool("figma_eval", "WARNING: Executes arbitrary JavaScript in the Figma plugin sandbox. Can read, modify, or delete any nodes in the document. Use with caution. Code is the body of an async function receiving: figma, hexToFigmaColor, appendOrInsertChild, loadAllFonts, getVariableByName, bindVariableToColor, resolveColorValue, sendProgressUpdate, introspectNode, setProperties. Use `return` to send results. Figma nodes auto-serialize to {id, name, type}.", {
    code: z2.string().describe("JavaScript code body. Use `return` for results. `figma` and helpers available as locals.")
  }, async ({ code }) => {
    try {
      const result = await sendCommandToFigma2("figma_eval", { code }, 120000);
      const typedResult = result;
      if (typedResult.success) {
        return { content: [{ type: "text", text: JSON.stringify(typedResult.result, null, 2) }] };
      } else {
        return { content: [{ type: "text", text: `Eval error: ${typedResult.error}` }] };
      }
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/migration.ts
function registerTools19(server, sendCommandToFigma2) {
  server.tool("diff_components", "Compare two components (old vs new) and produce a semantic property mapping + structural diff. Uses introspect on both components, then runs a 4-pass matching algorithm (exact key, suffix, type+name similarity, positional fallback) to map properties between versions. Use this before migrate_instance to understand what changed and review/adjust the mapping.", {
    sourceId: z2.string().describe("Node ID of the old/source component"),
    targetId: z2.string().describe("Node ID of the new/target component"),
    matchStrategy: z2.enum(["auto", "name", "position", "manual"]).optional().describe("Matching strategy: 'auto' (default) runs all passes, 'name' only name-based, 'position' only positional, 'manual' uses manualMappings only"),
    manualMappings: z2.record(z2.string(), z2.string()).optional().describe("Manual property mappings (sourceKey \u2192 targetKey) for 'manual' strategy or to supplement 'auto'")
  }, async ({ sourceId, targetId, matchStrategy, manualMappings }) => {
    try {
      const result = await sendCommandToFigma2("diff_components", {
        sourceId,
        targetId,
        matchStrategy: matchStrategy || "auto",
        manualMappings
      }, 60000);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error diffing components: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("migrate_instance", "Migrate a single component instance from one component to another while preserving overrides. Captures current override values via introspect, creates a new instance of the target component, and applies mapped overrides. Use diff_components first to generate the property mapping, or let it auto-map. Supports dryRun mode to preview changes without applying them.", {
    instanceId: z2.string().describe("Node ID of the instance to migrate"),
    targetComponentId: z2.string().describe("Node ID of the target component to migrate to"),
    propertyMapping: z2.record(z2.string(), z2.string()).optional().describe("Property mapping from diff_components (sourceKey \u2192 targetKey). If omitted, auto-generates mapping."),
    preservePosition: z2.boolean().optional().describe("Preserve x/y position of the instance (default: true)"),
    preserveSize: z2.boolean().optional().describe("Preserve width/height of the instance (default: false)"),
    dryRun: z2.boolean().optional().describe("Preview what would change without applying (default: false)")
  }, async ({ instanceId, targetComponentId, propertyMapping, preservePosition, preserveSize, dryRun }) => {
    try {
      const result = await sendCommandToFigma2("migrate_instance", {
        instanceId,
        targetComponentId,
        propertyMapping,
        preservePosition: preservePosition !== undefined ? preservePosition : true,
        preserveSize: preserveSize !== undefined ? preserveSize : false,
        dryRun: dryRun !== undefined ? dryRun : false
      }, 60000);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error migrating instance: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("batch_migrate", "Migrate all instances of a source component to a target component across the file or within a subtree. Finds instances by component name or ID, then applies migrate_instance to each with the provided property mapping. Supports dryRun to preview scope and changes before applying. Use diff_components first to generate the mapping.", {
    sourceComponentName: z2.string().optional().describe("Find instances by main component name (substring match)"),
    sourceComponentId: z2.string().optional().describe("Find instances by main component ID (exact match)"),
    targetComponentId: z2.string().describe("Node ID of the target component to migrate to"),
    propertyMapping: z2.record(z2.string(), z2.string()).optional().describe("Property mapping from diff_components (sourceKey \u2192 targetKey). If omitted, auto-generates mapping."),
    parentId: z2.string().optional().describe("Scope migration to descendants of this node"),
    limit: z2.number().optional().describe("Maximum number of instances to migrate"),
    dryRun: z2.boolean().optional().describe("Preview scope and changes without applying (default: false)")
  }, async ({ sourceComponentName, sourceComponentId, targetComponentId, propertyMapping, parentId, limit, dryRun }) => {
    if (!sourceComponentName && !sourceComponentId) {
      return {
        content: [{ type: "text", text: "Error: Either sourceComponentName or sourceComponentId must be provided" }]
      };
    }
    try {
      const result = await sendCommandToFigma2("batch_migrate", {
        sourceComponentName,
        sourceComponentId,
        targetComponentId,
        propertyMapping,
        parentId,
        limit,
        dryRun: dryRun !== undefined ? dryRun : false
      }, 120000);
      const typedResult = result;
      let text = `Found ${typedResult.totalFound} instances`;
      if (typedResult.dryRun) {
        text += ` (dry run \u2014 no changes applied)`;
      } else {
        text += `, migrated ${typedResult.migrated}`;
        if (typedResult.failed > 0)
          text += ` (${typedResult.failed} failed)`;
      }
      text += `

${JSON.stringify(typedResult.results)}`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error in batch migration: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
}

// src/claude_to_figma_mcp/tools/prototyping.ts
var EasingSchema = z2.object({
  type: z2.enum([
    "EASE_IN",
    "EASE_OUT",
    "EASE_IN_AND_OUT",
    "LINEAR",
    "EASE_IN_BACK",
    "EASE_OUT_BACK",
    "EASE_IN_AND_OUT_BACK",
    "CUSTOM_BEZIER"
  ]),
  easingFunctionCubicBezier: z2.object({
    x1: z2.number(),
    y1: z2.number(),
    x2: z2.number(),
    y2: z2.number()
  }).optional()
}).describe("Easing curve for the transition");
var TransitionSchema = z2.object({
  type: z2.enum([
    "DISSOLVE",
    "SMART_ANIMATE",
    "MOVE_IN",
    "MOVE_OUT",
    "PUSH",
    "SLIDE_IN",
    "SLIDE_OUT"
  ]).describe("Transition animation type"),
  duration: z2.number().positive().optional().describe("Duration in milliseconds (default 300)"),
  easing: EasingSchema.optional(),
  direction: z2.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]).optional().describe("Direction for directional transitions (MOVE_IN, PUSH, SLIDE_IN, etc.)")
}).describe("Transition animation applied when navigating");
var TriggerSchema = z2.object({
  type: z2.enum([
    "ON_CLICK",
    "ON_HOVER",
    "ON_PRESS",
    "ON_DRAG",
    "MOUSE_ENTER",
    "MOUSE_LEAVE",
    "MOUSE_UP",
    "MOUSE_DOWN",
    "AFTER_TIMEOUT",
    "ON_KEY_DOWN"
  ]).describe("Event that triggers the interaction"),
  delay: z2.number().optional().describe("Delay in ms before action fires (AFTER_TIMEOUT)"),
  keyCodes: z2.array(z2.number()).optional().describe("Key codes for ON_KEY_DOWN trigger")
});
var ActionSchema = z2.object({
  type: z2.enum(["NODE", "BACK", "CLOSE", "URL", "SET_VARIABLE", "CONDITIONAL"]).describe("Action type"),
  navigation: z2.enum(["NAVIGATE", "SWAP", "OVERLAY", "SCROLL_TO", "CHANGE_TO"]).optional().describe("Navigation type (required for NODE actions)"),
  destinationId: z2.string().optional().describe("Target node ID (required for NODE actions)"),
  transition: TransitionSchema.optional(),
  preserveScrollPosition: z2.boolean().optional(),
  overlayRelativePosition: z2.object({ x: z2.number(), y: z2.number() }).optional(),
  url: z2.string().optional().describe("URL to open (for URL actions)"),
  variableId: z2.string().optional(),
  variableValue: z2.any().optional()
});
var ReactionSchema = z2.object({
  trigger: TriggerSchema,
  actions: z2.array(ActionSchema).min(1).describe("Actions to execute when triggered")
});
function registerTools20(server, sendCommandToFigma2) {
  server.tool("set_reactions", "Set prototype interactions on a Figma node. Replaces the entire reactions array. Use this to wire click-to-navigate, hover overlays, scroll-to, or any prototype interaction. Each reaction has a trigger (ON_CLICK, ON_HOVER, etc.) and one or more actions (NAVIGATE, OVERLAY, BACK, URL, etc.). For NODE actions, destinationId must reference an existing frame ID.", {
    nodeId: z2.string().describe("The node to set reactions on"),
    reactions: z2.array(ReactionSchema).describe("Array of reactions to set")
  }, async ({ nodeId, reactions }) => {
    try {
      const result = await sendCommandToFigma2("set_reactions", { nodeId, reactions }, 30000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("add_reaction", "Add a single prototype interaction to a node without removing existing interactions. Reads current reactions, appends the new one, and writes back. Use this when a node already has interactions and you want to add another (e.g., add hover state to a button that already has on-click).", {
    nodeId: z2.string().describe("The node to add a reaction to"),
    trigger: TriggerSchema.describe("The trigger for the new reaction"),
    action: ActionSchema.describe("The action to execute when triggered")
  }, async ({ nodeId, trigger, action }) => {
    try {
      const result = await sendCommandToFigma2("add_reaction", { nodeId, trigger, action }, 30000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding reaction: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("remove_reactions", "Remove prototype interactions from a node. With no triggerType, removes ALL reactions. With a triggerType (e.g., 'ON_HOVER'), removes only reactions matching that trigger, preserving others.", {
    nodeId: z2.string().describe("The node to remove reactions from"),
    triggerType: z2.enum([
      "ON_CLICK",
      "ON_HOVER",
      "ON_PRESS",
      "ON_DRAG",
      "MOUSE_ENTER",
      "MOUSE_LEAVE",
      "MOUSE_UP",
      "MOUSE_DOWN",
      "AFTER_TIMEOUT",
      "ON_KEY_DOWN"
    ]).optional().describe("If provided, only remove reactions with this trigger type")
  }, async ({ nodeId, triggerType }) => {
    try {
      const result = await sendCommandToFigma2("remove_reactions", { nodeId, triggerType }, 30000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing reactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("get_interactions", "Read prototype interactions from a node with resolved destination names. Unlike get_reactions (which is designed for connector-line workflows), this returns a clean interaction summary: trigger type, action type, destination frame name and ID, transition details. Use this to inspect existing prototype wiring before modifying it.", {
    nodeId: z2.string().describe("The node to read interactions from"),
    recursive: z2.boolean().optional().describe("If true, also scan children for interactions (default false)")
  }, async ({ nodeId, recursive }) => {
    try {
      const result = await sendCommandToFigma2("get_interactions", { nodeId, recursive }, 30000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting interactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
  server.tool("batch_set_reactions", "Set prototype interactions on multiple nodes in a single call. Essential for wiring an entire screen's navigation (nav bar links, card clicks, button targets) efficiently. Each operation sets the full reactions array on one node.", {
    operations: z2.array(z2.object({
      nodeId: z2.string().describe("Node to set reactions on"),
      reactions: z2.array(ReactionSchema).describe("Reactions to set on this node")
    })).min(1).describe("Array of { nodeId, reactions } operations")
  }, async ({ operations }) => {
    try {
      const result = await sendCommandToFigma2("batch_set_reactions", { operations }, 60000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error batch setting reactions: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}

// src/claude_to_figma_mcp/tools/wireframe-parser.ts
import * as fs3 from "fs";
import * as path3 from "path";
function detectZone(html) {
  if (html.includes("#1e2a3a") || html.includes("#131925") || html.includes("#000000") || html.includes("ds-welcome-banner") || html.includes("background:linear-gradient") && html.includes("#1e2a3a") || html.includes("background:var(--wf-ink)") && html.includes("color:rgba(255,255,255")) {
    return "full_brand";
  }
  if (html.includes("ds-kpi") || html.includes("--wf-accent") || html.includes("border-left") && html.includes("accent") || html.includes("border:2px solid var(--wf-accent)") || html.includes("border-top:3px solid var(--wf-accent)")) {
    return "brand_tinted";
  }
  return "no_brand";
}
function detectTemplate(html, comment) {
  const c = comment.toLowerCase();
  const h = html.toLowerCase();
  if (c.includes("welcome") || c.includes("hero") || h.includes("ds-welcome-banner")) {
    if (html.includes("background:linear-gradient") || html.includes("ds-welcome-banner")) {
      return "hero_takeover";
    }
    return "welcome_banner_slds";
  }
  if (c.includes("checklist") || c.includes("getting started") || c.includes("setup")) {
    return "slds_checklist";
  }
  if (c.includes("kpi") || c.includes("metrics") || c.includes("statistics") || c.includes("your statistics")) {
    return "kpi_cards";
  }
  if (h.includes("ds-data-table") || h.includes("wf-table") || h.includes("<table")) {
    return "slds_data_table";
  }
  if (c.includes("progress") || c.includes("certification progress")) {
    return "progress_card";
  }
  if (c.includes("empty state") || h.includes("ds-empty-state")) {
    return "slds_empty_state";
  }
  if (h.includes("ds-alert") && !h.includes("ds-card") && !h.includes("ds-empty-state") && !h.includes("ds-dashboard-grid")) {
    return "slds_alert";
  }
  if (c.includes("quick action")) {
    return "quick_actions";
  }
  if (c.includes("sidebar") || c.includes("right column")) {
    return "slds_sidebar";
  }
  if (c.includes("deadline") || c.includes("upcoming deadline")) {
    return "deadline_cards";
  }
  if (c.includes("activity") || c.includes("recent activity")) {
    return "activity_feed";
  }
  if (c.includes("psm") || c.includes("partner success") || c.includes("contact")) {
    return "psm_contact_card";
  }
  if (c.includes("announcement") || c.includes("news") || c.includes("program update") || c.includes("update")) {
    return "slds_alert_list";
  }
  if (c.includes("mfa") || c.includes("nag") || c.includes("countersign") || c.includes("notification")) {
    return "notification_banner";
  }
  if (c.includes("program") || c.includes("portal") || c.includes("enrollment")) {
    return "slds_card_list";
  }
  if (c.includes("deal")) {
    if (h.includes("ds-empty-state")) {
      return "slds_empty_state";
    }
    return "slds_card_list";
  }
  if (c.includes("training")) {
    if (h.includes("ds-empty-state")) {
      return "slds_empty_state";
    }
    return "slds_card_list";
  }
  if (c.includes("left column") || c.includes("main content") || c.includes("main column")) {
    return "__column_wrapper__";
  }
  if (c.includes("main grid") || c.includes("dashboard grid")) {
    return "__grid_wrapper__";
  }
  return "slds_card_list";
}
function extractText(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}
function extractAllText(html, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "gi");
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text.length > 0) {
      results.push(text);
    }
  }
  return results;
}
function extractLinks(html) {
  const results = [];
  const regex = /<a[^>]+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].trim().replace(/&#\d+;/g, "").replace(/&amp;/g, "&").trim();
    if (text.length > 0) {
      results.push({ text, href: match[1] });
    }
  }
  return results;
}
function countElements(html, selector) {
  const regex = new RegExp(selector, "gi");
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}
function extractStatusBadges(html) {
  const results = [];
  const regex = /ds-status-badge[^"]*"[^>]*>([^<]+)</gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}
function extractProps(html, template, comment) {
  const props = {};
  switch (template) {
    case "hero_takeover":
    case "welcome_banner_slds": {
      props.heading = extractText(html, "h1");
      const paragraphs = extractAllText(html, "p");
      if (paragraphs.length > 0)
        props.subtitle = paragraphs[0];
      if (paragraphs.length > 1)
        props.meta = paragraphs[1];
      const links = extractLinks(html);
      if (links.length > 0)
        props.cta = links[0];
      const badgeMatch = html.match(/border-radius:\s*20px[^>]*>([^<]+)/);
      if (badgeMatch)
        props.roleBadge = badgeMatch[1].trim();
      const tierMatch = html.match(/font-size:\s*28px[^>]*>([^<]+)/);
      if (tierMatch)
        props.tierProgress = tierMatch[1].trim();
      const subMatch = html.match(/ds-welcome-banner-sub"[^>]*>([^<]+)/);
      if (subMatch)
        props.subtitle = subMatch[1].trim().replace(/&middot;/g, "\xB7");
      const metaMatch = html.match(/ds-welcome-banner-meta"[^>]*>([^<]+)/);
      if (metaMatch)
        props.meta = metaMatch[1].trim();
      if (html.includes("ds-progress-bar")) {
        const fillMatch = html.match(/width:\s*(\d+)%/);
        if (fillMatch)
          props.setupProgress = parseInt(fillMatch[1], 10);
      }
      break;
    }
    case "slds_checklist": {
      const gsItems = countElements(html, 'gs-item|gs-check|class="gs-item"');
      const listItems = extractAllText(html, "p").filter((p) => p.length > 5 && p.length < 80 && /^[A-Z]/.test(p));
      props.totalItems = gsItems > 0 ? gsItems : listItems.length;
      const itemTitles = [];
      const titleRegex = /font-weight:\s*600[^>]*>([^<]+)</gi;
      let titleMatch;
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        const t = titleMatch[1].trim();
        if (t.length > 5 && t.length < 80)
          itemTitles.push(t);
      }
      if (itemTitles.length > 0)
        props.items = itemTitles;
      const headerMatch = html.match(/gs-header-title[^>]*>([^<]+)/);
      if (headerMatch)
        props.headerText = headerMatch[1].trim();
      const stepCount = countElements(html, 'role="listitem"');
      if (stepCount > 0)
        props.totalSteps = stepCount;
      break;
    }
    case "kpi_cards": {
      const labels = extractAllText(html, "span");
      const hlLabels = [];
      const hlRegex = /ds-hl-label[^>]*>([^<]+)/gi;
      let hlMatch;
      while ((hlMatch = hlRegex.exec(html)) !== null) {
        hlLabels.push(hlMatch[1].trim());
      }
      const hlValues = [];
      const hvRegex = /ds-hl-value[^>]*>([^<]+)/gi;
      let hvMatch;
      while ((hvMatch = hvRegex.exec(html)) !== null) {
        hlValues.push(hvMatch[1].trim());
      }
      if (hlLabels.length > 0) {
        props.stats = hlLabels.map((label, i) => ({
          label,
          value: hlValues[i] || ""
        }));
      }
      break;
    }
    case "slds_data_table": {
      props.columns = countElements(html, "<th");
      props.rows = countElements(html, "<tr") - 1;
      if (props.rows < 0)
        props.rows = countElements(html, "<tr");
      const headings = extractAllText(html, "th");
      if (headings.length > 0)
        props.columnHeaders = headings;
      break;
    }
    case "progress_card": {
      props.heading = extractText(html, "h3") || extractText(html, "h2");
      const progressMatch = html.match(/width:\s*(\d+)%/);
      if (progressMatch)
        props.progressPercent = parseInt(progressMatch[1], 10);
      const countMatch = html.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
      if (countMatch) {
        props.completed = parseInt(countMatch[1], 10);
        props.total = parseInt(countMatch[2], 10);
      }
      const captions = extractAllText(html, "p").filter((p) => p.length > 10);
      if (captions.length > 0)
        props.description = captions[0];
      break;
    }
    case "slds_alert": {
      const alertText = extractAllText(html, "span");
      if (alertText.length > 0)
        props.message = alertText.join(" ").substring(0, 200);
      if (html.includes("alert--error"))
        props.variant = "error";
      else if (html.includes("alert--warning"))
        props.variant = "warning";
      else if (html.includes("alert--success"))
        props.variant = "success";
      else
        props.variant = "info";
      break;
    }
    case "quick_actions": {
      const actionItems = [];
      const boldTexts = extractAllText(html, "p");
      const actionLinks = extractLinks(html);
      for (let i = 0;i < boldTexts.length; i += 2) {
        const item = {
          title: boldTexts[i]
        };
        if (i + 1 < boldTexts.length)
          item.caption = boldTexts[i + 1];
        const link = actionLinks.find((l) => l.text.includes(boldTexts[i]) || boldTexts[i].includes(l.text));
        if (link)
          item.href = link.href;
        actionItems.push(item);
      }
      if (actionItems.length > 0)
        props.actions = actionItems;
      if (actionItems.length === 0) {
        const h4Titles = extractAllText(html, "div");
        const h4Actions = [];
        const captionRegex = /ds-caption[^>]*>([^<]+)/gi;
        const captions = [];
        let capMatch;
        while ((capMatch = captionRegex.exec(html)) !== null) {
          captions.push(capMatch[1].trim());
        }
        const h4Regex = /ds-h4[^>]*>([^<]+)/gi;
        const titles = [];
        let h4Match;
        while ((h4Match = h4Regex.exec(html)) !== null) {
          titles.push(h4Match[1].trim());
        }
        for (let i = 0;i < titles.length; i++) {
          h4Actions.push({
            title: titles[i],
            caption: captions[i] || undefined
          });
        }
        if (h4Actions.length > 0)
          props.actions = h4Actions;
      }
      break;
    }
    case "slds_empty_state": {
      props.heading = extractText(html, "p");
      const emptyTexts = extractAllText(html, "p");
      if (emptyTexts.length > 1)
        props.description = emptyTexts[1];
      const links = extractLinks(html);
      if (links.length > 0)
        props.primaryCta = links[0];
      if (links.length > 1)
        props.secondaryCta = links[1];
      break;
    }
    case "deadline_cards": {
      const deadlines = [];
      const h4Titles = extractAllText(html, "h4");
      const statuses = extractStatusBadges(html);
      const descriptions = extractAllText(html, "p").filter((p) => p.length > 5);
      for (let i = 0;i < h4Titles.length; i++) {
        deadlines.push({
          title: h4Titles[i],
          status: statuses[i] || undefined,
          description: descriptions[i] || undefined
        });
      }
      if (deadlines.length > 0)
        props.deadlines = deadlines;
      break;
    }
    case "activity_feed": {
      props.heading = extractText(html, "h3") || "Recent Activity";
      props.rows = countElements(html, "<tr");
      const links = extractLinks(html);
      if (links.length > 0)
        props.viewAllLink = links[links.length - 1];
      break;
    }
    case "psm_contact_card": {
      const texts = extractAllText(html, "p");
      const psmName = texts.find((t) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t));
      if (psmName)
        props.psmName = psmName;
      const quote = texts.find((t) => t.startsWith('"') || t.startsWith("\u201C"));
      if (quote)
        props.message = quote;
      const attrMatch = texts.find((t) => t.includes("\u2014") || t.includes("--"));
      if (attrMatch)
        props.attribution = attrMatch;
      const links = extractLinks(html);
      if (links.length > 0)
        props.cta = links[0];
      break;
    }
    case "slds_alert_list": {
      const alerts = [];
      const alertRegex = /ds-alert\s+ds-alert--(\w+)[^>]*>([\s\S]*?)(?=<\/div>\s*(?:<div class="ds-alert|$))/gi;
      let alertMatch;
      while ((alertMatch = alertRegex.exec(html)) !== null) {
        const variant = alertMatch[1];
        const innerHtml = alertMatch[2];
        const text = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 200);
        if (text.length > 5) {
          alerts.push({ variant, text });
        }
      }
      if (alerts.length > 0) {
        props.alerts = alerts;
      } else {
        props.alertCount = countElements(html, "ds-alert");
      }
      break;
    }
    case "notification_banner": {
      props.heading = extractText(html, "div");
      const links = extractLinks(html);
      if (links.length > 0)
        props.cta = links[0];
      if (html.includes("mfa") || html.toLowerCase().includes("multi-factor")) {
        props.bannerType = "mfa_nag";
      } else if (html.includes("countersign")) {
        props.bannerType = "countersign_success";
      }
      break;
    }
    case "slds_card_list":
    default: {
      props.heading = extractText(html, "h2") || extractText(html, "h3");
      const subItems = extractAllText(html, "p").filter((p) => p.length > 5);
      if (subItems.length > 0)
        props.itemCount = Math.min(subItems.length, 20);
      const links = extractLinks(html);
      if (links.length > 0)
        props.headerLink = links[0];
      const badges = extractStatusBadges(html);
      if (badges.length > 0)
        props.statusBadges = badges;
      break;
    }
  }
  return props;
}
function detectPersona(title) {
  const t = title.toLowerCase();
  if (t.includes("admin"))
    return "admin";
  if (t.includes("pm") || t.includes("partner manager") || t.includes("manager home"))
    return "pm";
  return "rep";
}
function detectVariant(title) {
  const t = title.toLowerCase();
  if (t.includes("day 0") || t.includes("day0") || t.includes("new user") || t.includes("first login")) {
    return "day0";
  }
  return "dayN";
}
function splitBySections(html) {
  const sections = [];
  let body = html;
  const mainMatch = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    body = mainMatch[1];
  } else {
    const containerMatch = body.match(/class="ds-page-container"[^>]*>([\s\S]*?)(?=<footer|<div class="wf-design-notes"|<script)/i);
    if (containerMatch) {
      body = containerMatch[1];
    }
  }
  body = body.replace(/<div class="wf-design-notes"[\s\S]*?<\/div>\s*$/i, "");
  const commentRegex = /<!--\s*(.*?)\s*-->/g;
  const comments = [];
  let match;
  while ((match = commentRegex.exec(body)) !== null) {
    comments.push({ text: match[1].trim(), index: match.index + match[0].length });
  }
  if (comments.length === 0) {
    sections.push({ comment: "Page content", html: body });
    return sections;
  }
  for (let i = 0;i < comments.length; i++) {
    const start = comments[i].index;
    const end = i + 1 < comments.length ? body.indexOf(`<!--`, start) : body.length;
    const sectionHtml = body.substring(start, end).trim();
    if (sectionHtml.length > 10) {
      sections.push({
        comment: comments[i].text,
        html: sectionHtml
      });
    }
  }
  return sections;
}
function parseWireframe(filePath) {
  const resolved = path3.resolve(filePath);
  if (!path3.isAbsolute(filePath) || filePath.split(path3.sep).includes("..")) {
    throw new Error(`Invalid file path: must be absolute with no '..' traversal`);
  }
  if (!fs3.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const raw = fs3.readFileSync(resolved, "utf-8");
  const fileSize = Buffer.byteLength(raw, "utf-8");
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : "Unknown";
  const pageTitle = rawTitle.replace(/\s*[\u00B7\-]\s*Equinix PCP Partner Portal\s*$/i, "").trim();
  const persona = detectPersona(rawTitle);
  const variant = detectVariant(rawTitle);
  const rawSections = splitBySections(raw);
  const sections = [];
  let order = 0;
  for (const rawSection of rawSections) {
    const template = detectTemplate(rawSection.html, rawSection.comment);
    if (template.startsWith("__"))
      continue;
    if (rawSection.html.replace(/<[^>]+>/g, "").trim().length < 5)
      continue;
    const zone = detectZone(rawSection.html);
    const props = extractProps(rawSection.html, template, rawSection.comment);
    sections.push({
      template,
      zone,
      props,
      order: order++,
      sourceElement: `<!-- ${rawSection.comment} -->`
    });
  }
  const inputTokens = Math.round(fileSize / 4);
  const outputJson = JSON.stringify({ pageTitle, persona, variant, sections });
  const outputTokens = Math.round(Buffer.byteLength(outputJson, "utf-8") / 4);
  const savings = inputTokens > 0 ? Math.round((1 - outputTokens / inputTokens) * 100) : 0;
  return {
    pageTitle,
    persona,
    variant,
    sections,
    totalSections: sections.length,
    estimatedTokenSavings: `~${savings}% (${inputTokens} input tokens -> ${outputTokens} output tokens)`
  };
}
function registerTools21(server, _sendCommandToFigma) {
  server.tool("parse_wireframe", "Parse an HTML wireframe file and emit compact section specs for build_page_section. Reads the HTML, identifies sections by CSS classes and HTML comments, maps each to a template + props, and returns the complete page manifest. Eliminates the need to read/parse HTML manually \u2014 ~10x token savings vs reading raw HTML.", {
    filePath: z2.string().describe("Absolute path to the HTML wireframe file")
  }, async ({ filePath }) => {
    try {
      if (!fs3.existsSync(filePath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: File not found: ${filePath}`
            }
          ]
        };
      }
      if (!filePath.endsWith(".html") && !filePath.endsWith(".htm")) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Expected an HTML file, got: ${filePath}`
            }
          ]
        };
      }
      const result = parseWireframe(filePath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error parsing wireframe: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}

// src/claude_to_figma_mcp/templates/pcp-sections.ts
var BRAND3 = {
  bgDark: "#131925",
  bgBlack: "#000000",
  bgSecondary: "#151515",
  accentRed: "#e91c24",
  accentPurple: "#ae19ff",
  accentViolet: "#7739d9",
  textPrimary: "#ffffff",
  textSecondary: "#bdc1ca",
  textMuted: "#5a657b",
  cardBorder: "#2f3541",
  sectionPadding: 128,
  contentInset: 100,
  cardSpacing: 36,
  cardPadding: 36,
  containerRadius: 12,
  cardRadius: 6,
  mediaRadius: 8
};
var SLDS = {
  surface: "#ffffff",
  surfaceSecondary: "#f3f3f3",
  border: "#e5e5e5",
  textPrimary: "#181818",
  textSecondary: "#706e6b",
  textInverse: "#ffffff",
  actionPrimary: "#0176d3",
  destructive: "#ba0517",
  bodySize: 14,
  headingSmall: 20,
  headingMedium: 24,
  headingLarge: 28,
  radius: 4,
  spacingSmall: 12,
  spacingMedium: 16,
  spacingLarge: 24,
  spacingXLarge: 32,
  spacingXXLarge: 48
};
function textNode(opts) {
  const node = {
    type: "text",
    text: opts.text,
    fontSize: opts.fontSize,
    fontColor: opts.fontColor
  };
  if (opts.fontWeight !== undefined)
    node.fontWeight = opts.fontWeight;
  if (opts.name)
    node.name = opts.name;
  if (opts.width !== undefined)
    node.width = opts.width;
  if (opts.letterSpacing !== undefined)
    node.letterSpacing = opts.letterSpacing;
  if (opts.lineHeight !== undefined)
    node.lineHeight = opts.lineHeight;
  if (opts.textCase)
    node.textCase = opts.textCase;
  if (opts.textAlignHorizontal)
    node.textAlignHorizontal = opts.textAlignHorizontal;
  if (opts.fontFamily)
    node.fontFamily = opts.fontFamily;
  return node;
}
function vStack(opts) {
  const frame = {
    type: "frame",
    width: opts.width,
    height: opts.height,
    layoutMode: "VERTICAL"
  };
  if (opts.name)
    frame.name = opts.name;
  if (opts.fillColor)
    frame.fillColor = opts.fillColor;
  if (opts.strokeColor)
    frame.strokeColor = opts.strokeColor;
  if (opts.strokeWeight !== undefined)
    frame.strokeWeight = opts.strokeWeight;
  if (opts.cornerRadius !== undefined)
    frame.cornerRadius = opts.cornerRadius;
  if (opts.itemSpacing !== undefined)
    frame.itemSpacing = opts.itemSpacing;
  if (opts.paddingTop !== undefined)
    frame.paddingTop = opts.paddingTop;
  if (opts.paddingRight !== undefined)
    frame.paddingRight = opts.paddingRight;
  if (opts.paddingBottom !== undefined)
    frame.paddingBottom = opts.paddingBottom;
  if (opts.paddingLeft !== undefined)
    frame.paddingLeft = opts.paddingLeft;
  if (opts.primaryAxisAlignItems)
    frame.primaryAxisAlignItems = opts.primaryAxisAlignItems;
  if (opts.counterAxisAlignItems)
    frame.counterAxisAlignItems = opts.counterAxisAlignItems;
  if (opts.layoutSizingHorizontal)
    frame.layoutSizingHorizontal = opts.layoutSizingHorizontal;
  if (opts.layoutSizingVertical)
    frame.layoutSizingVertical = opts.layoutSizingVertical;
  if (opts.clipsContent !== undefined)
    frame.clipsContent = opts.clipsContent;
  if (opts.children)
    frame.children = opts.children;
  return frame;
}
function hStack(opts) {
  const frame = {
    type: "frame",
    width: opts.width,
    height: opts.height,
    layoutMode: "HORIZONTAL"
  };
  if (opts.name)
    frame.name = opts.name;
  if (opts.fillColor)
    frame.fillColor = opts.fillColor;
  if (opts.strokeColor)
    frame.strokeColor = opts.strokeColor;
  if (opts.strokeWeight !== undefined)
    frame.strokeWeight = opts.strokeWeight;
  if (opts.cornerRadius !== undefined)
    frame.cornerRadius = opts.cornerRadius;
  if (opts.itemSpacing !== undefined)
    frame.itemSpacing = opts.itemSpacing;
  if (opts.paddingTop !== undefined)
    frame.paddingTop = opts.paddingTop;
  if (opts.paddingRight !== undefined)
    frame.paddingRight = opts.paddingRight;
  if (opts.paddingBottom !== undefined)
    frame.paddingBottom = opts.paddingBottom;
  if (opts.paddingLeft !== undefined)
    frame.paddingLeft = opts.paddingLeft;
  if (opts.primaryAxisAlignItems)
    frame.primaryAxisAlignItems = opts.primaryAxisAlignItems;
  if (opts.counterAxisAlignItems)
    frame.counterAxisAlignItems = opts.counterAxisAlignItems;
  if (opts.layoutSizingHorizontal)
    frame.layoutSizingHorizontal = opts.layoutSizingHorizontal;
  if (opts.layoutSizingVertical)
    frame.layoutSizingVertical = opts.layoutSizingVertical;
  if (opts.clipsContent !== undefined)
    frame.clipsContent = opts.clipsContent;
  if (opts.children)
    frame.children = opts.children;
  return frame;
}
function ctaButton(label, color) {
  const bg = color || BRAND3.accentRed;
  return hStack({
    name: "CTA Button",
    width: 200,
    height: 48,
    fillColor: bg,
    cornerRadius: 4,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 24,
    paddingRight: 24,
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    children: [
      textNode({
        text: label,
        fontSize: 14,
        fontWeight: 700,
        fontColor: BRAND3.textPrimary,
        name: "CTA Label"
      })
    ]
  });
}
function sldsCard(opts) {
  const frame = vStack({
    name: opts.name || "SLDS Card",
    width: opts.width,
    height: 100,
    fillColor: SLDS.surface,
    strokeColor: SLDS.border,
    strokeWeight: 1,
    cornerRadius: SLDS.radius,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    paddingTop: SLDS.spacingLarge,
    paddingRight: SLDS.spacingLarge,
    paddingBottom: SLDS.spacingLarge,
    paddingLeft: SLDS.spacingLarge,
    itemSpacing: SLDS.spacingMedium,
    children: opts.children
  });
  if (opts.accentBorderLeft) {
    return hStack({
      name: (opts.name || "SLDS Card") + " (accent)",
      width: opts.width,
      height: 100,
      layoutSizingHorizontal: "FILL",
      layoutSizingVertical: "HUG",
      children: [
        {
          type: "rectangle",
          width: 4,
          height: 100,
          name: "Accent Border",
          fillColor: opts.accentBorderLeft
        },
        frame
      ]
    });
  }
  return frame;
}
function statusBadge(status) {
  const colorMap = {
    complete: "#059669",
    current: SLDS.actionPrimary,
    pending: SLDS.textSecondary
  };
  const bg = colorMap[status] || SLDS.textSecondary;
  return hStack({
    name: `Badge ${status}`,
    width: 80,
    height: 24,
    fillColor: bg,
    cornerRadius: 12,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    children: [
      textNode({
        text: status.charAt(0).toUpperCase() + status.slice(1),
        fontSize: 12,
        fontWeight: 600,
        fontColor: SLDS.textInverse,
        name: "Badge Label"
      })
    ]
  });
}
var SECTION_TEMPLATES = {
  hero_takeover: {
    zone: "full_brand",
    description: "Full-width hero banner with optional overline, heading, body, CTA, and persona.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const h = props.height ?? 600;
      const children = [];
      if (props.overline) {
        children.push(textNode({
          text: props.overline,
          fontSize: 13.6,
          fontWeight: 800,
          fontColor: BRAND3.textMuted,
          letterSpacing: 1,
          textCase: "UPPER",
          name: "Overline",
          width: w - BRAND3.contentInset * 2
        }));
      }
      children.push(textNode({
        text: props.heading,
        fontSize: 47,
        fontWeight: 700,
        fontColor: BRAND3.textPrimary,
        letterSpacing: -1,
        lineHeight: Math.round(47 * 1.2),
        name: "Heading",
        width: w - BRAND3.contentInset * 2
      }));
      if (props.body) {
        children.push(textNode({
          text: props.body,
          fontSize: 18,
          fontWeight: 300,
          fontColor: BRAND3.textSecondary,
          lineHeight: Math.round(18 * 1.4),
          name: "Body",
          width: w - BRAND3.contentInset * 2
        }));
      }
      if (props.cta) {
        children.push(ctaButton(props.cta.label, props.cta.color));
      }
      if (props.persona) {
        children.push(textNode({
          text: props.persona,
          fontSize: 14,
          fontWeight: 400,
          fontColor: BRAND3.textMuted,
          name: "Persona"
        }));
      }
      return vStack({
        name: "Hero Takeover",
        width: w,
        height: h,
        fillColor: BRAND3.bgDark,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: 24,
        layoutSizingVertical: "HUG",
        clipsContent: true,
        children
      });
    }
  },
  metrics_bar: {
    zone: "full_brand",
    description: "Row of centered stat metrics (value, qualifier, meta) in a gradient-bg container.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const metrics = props.metrics;
      const radius = props.containerRadius ?? BRAND3.containerRadius;
      const metricChildren = metrics.map((m, i) => vStack({
        name: `Metric ${i + 1}`,
        width: 300,
        height: 100,
        itemSpacing: 8,
        primaryAxisAlignItems: "CENTER",
        counterAxisAlignItems: "CENTER",
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        children: [
          textNode({
            text: m.value,
            fontSize: 56,
            fontWeight: 700,
            fontColor: BRAND3.textPrimary,
            textAlignHorizontal: "CENTER",
            name: "Value"
          }),
          textNode({
            text: m.qualifier,
            fontSize: 18,
            fontWeight: 300,
            fontColor: BRAND3.textSecondary,
            textAlignHorizontal: "CENTER",
            name: "Qualifier"
          }),
          textNode({
            text: m.meta,
            fontSize: 13.6,
            fontWeight: 400,
            fontColor: BRAND3.textMuted,
            textAlignHorizontal: "CENTER",
            name: "Meta"
          })
        ]
      }));
      return hStack({
        name: "Metrics Bar",
        width: w,
        height: 100,
        fillColor: BRAND3.bgDark,
        cornerRadius: radius,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: BRAND3.cardSpacing,
        primaryAxisAlignItems: "SPACE_BETWEEN",
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children: metricChildren
      });
    }
  },
  article_deck_3up: {
    zone: "full_brand",
    description: "3 promo article cards with title, body, and arrow-right indicator.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const contentW = w - BRAND3.contentInset * 2;
      const cardW = Math.floor((contentW - BRAND3.cardSpacing * 2) / 3);
      const articles = props.articles;
      const sectionChildren = [];
      if (props.heading) {
        sectionChildren.push(textNode({
          text: props.heading,
          fontSize: 28,
          fontWeight: 700,
          fontColor: BRAND3.textPrimary,
          name: "Deck Heading",
          width: contentW
        }));
      }
      const cards = articles.map((a, i) => {
        const cardChildren = [];
        if (a.media) {
          cardChildren.push({
            type: "rectangle",
            width: cardW,
            height: 180,
            fillColor: BRAND3.bgSecondary,
            cornerRadius: BRAND3.cardRadius,
            name: "Media Placeholder"
          });
        }
        cardChildren.push(vStack({
          name: "Card Content",
          width: cardW,
          height: 100,
          paddingTop: 24,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingRight: 24,
          itemSpacing: 12,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: a.title,
              fontSize: 22,
              fontWeight: 700,
              fontColor: BRAND3.textPrimary,
              name: "Card Title",
              width: cardW - 48
            }),
            textNode({
              text: a.body,
              fontSize: 16,
              fontWeight: 300,
              fontColor: BRAND3.textSecondary,
              lineHeight: Math.round(16 * 1.4),
              name: "Card Body",
              width: cardW - 48
            }),
            textNode({
              text: "\u2192",
              fontSize: 18,
              fontWeight: 700,
              fontColor: BRAND3.accentRed,
              name: "Arrow"
            })
          ]
        }));
        return vStack({
          name: `Article Card ${i + 1}`,
          width: cardW,
          height: 100,
          fillColor: BRAND3.bgDark,
          cornerRadius: BRAND3.cardRadius,
          layoutSizingVertical: "HUG",
          clipsContent: true,
          children: cardChildren
        });
      });
      sectionChildren.push(hStack({
        name: "Cards Row",
        width: contentW,
        height: 100,
        itemSpacing: BRAND3.cardSpacing,
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        children: cards
      }));
      return vStack({
        name: "Article Deck 3-Up",
        width: w,
        height: 100,
        fillColor: BRAND3.bgDark,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: BRAND3.cardSpacing,
        layoutSizingVertical: "HUG",
        children: sectionChildren
      });
    }
  },
  bold_cta: {
    zone: "full_brand",
    description: "Centered CTA section with gradient bg, fortress icon placeholder, heading, body, and CTA button.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const children = [];
      children.push({
        type: "rectangle",
        width: 92,
        height: 60,
        fillColor: BRAND3.accentRed,
        cornerRadius: 4,
        name: "Fortress Icon Placeholder"
      });
      children.push(textNode({
        text: props.heading,
        fontSize: 47,
        fontWeight: 700,
        fontColor: BRAND3.textPrimary,
        letterSpacing: -1,
        lineHeight: Math.round(47 * 1.2),
        textAlignHorizontal: "CENTER",
        name: "Heading",
        width: w - BRAND3.contentInset * 2
      }));
      if (props.body) {
        children.push(textNode({
          text: props.body,
          fontSize: 18,
          fontWeight: 300,
          fontColor: BRAND3.textSecondary,
          lineHeight: Math.round(18 * 1.4),
          textAlignHorizontal: "CENTER",
          name: "Body",
          width: w - BRAND3.contentInset * 2
        }));
      }
      children.push(ctaButton(props.cta.label, props.cta.color));
      return vStack({
        name: "Bold CTA",
        width: w,
        height: 100,
        fillColor: BRAND3.bgDark,
        cornerRadius: BRAND3.containerRadius,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: 24,
        primaryAxisAlignItems: "CENTER",
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children
      });
    }
  },
  global_highlights: {
    zone: "full_brand",
    description: "3 dark stat cards with title, body, stat number, and stat label.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const contentW = w - BRAND3.contentInset * 2;
      const cardW = Math.floor((contentW - BRAND3.cardSpacing * 2) / 3);
      const cards = props.cards;
      const cardNodes = cards.map((c, i) => vStack({
        name: `Highlight Card ${i + 1}`,
        width: cardW,
        height: 100,
        fillColor: BRAND3.bgBlack,
        strokeColor: BRAND3.cardBorder,
        strokeWeight: 1,
        cornerRadius: BRAND3.cardRadius,
        paddingTop: BRAND3.cardPadding,
        paddingRight: BRAND3.cardPadding,
        paddingBottom: BRAND3.cardPadding,
        paddingLeft: BRAND3.cardPadding,
        itemSpacing: 58,
        layoutSizingVertical: "HUG",
        children: [
          vStack({
            name: "Card Text",
            width: cardW - BRAND3.cardPadding * 2,
            height: 50,
            itemSpacing: 12,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: c.title,
                fontSize: 22,
                fontWeight: 700,
                fontColor: BRAND3.textPrimary,
                name: "Card Title",
                width: cardW - BRAND3.cardPadding * 2
              }),
              textNode({
                text: c.body,
                fontSize: 16,
                fontWeight: 300,
                fontColor: BRAND3.textSecondary,
                lineHeight: Math.round(16 * 1.4),
                name: "Card Body",
                width: cardW - BRAND3.cardPadding * 2
              })
            ]
          }),
          vStack({
            name: "Card Stat",
            width: cardW - BRAND3.cardPadding * 2,
            height: 50,
            itemSpacing: 4,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: c.stat,
                fontSize: 56,
                fontWeight: 700,
                fontColor: BRAND3.textPrimary,
                name: "Stat Value"
              }),
              textNode({
                text: c.statLabel,
                fontSize: 14,
                fontWeight: 400,
                fontColor: BRAND3.textMuted,
                name: "Stat Label"
              })
            ]
          })
        ]
      }));
      return hStack({
        name: "Global Highlights",
        width: w,
        height: 100,
        fillColor: BRAND3.bgDark,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: BRAND3.cardSpacing,
        layoutSizingVertical: "HUG",
        children: cardNodes
      });
    }
  },
  avatar_quotation: {
    zone: "full_brand",
    description: "Quote with large circular avatar placeholder, quote text, name, and title.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const avatarSize = props.size ?? 320;
      return hStack({
        name: "Avatar Quotation",
        width: w,
        height: 100,
        fillColor: BRAND3.bgDark,
        paddingTop: BRAND3.sectionPadding,
        paddingBottom: BRAND3.sectionPadding,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        itemSpacing: 24,
        counterAxisAlignItems: "CENTER",
        layoutSizingVertical: "HUG",
        children: [
          {
            type: "rectangle",
            width: avatarSize,
            height: avatarSize,
            fillColor: BRAND3.accentPurple,
            cornerRadius: Math.round(avatarSize / 2),
            name: "Avatar Placeholder"
          },
          vStack({
            name: "Quote Block",
            width: w - BRAND3.contentInset * 2 - avatarSize - 24,
            height: 100,
            itemSpacing: 16,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: `\u201C${props.quote}\u201D`,
                fontSize: 22,
                fontWeight: 300,
                fontColor: BRAND3.textPrimary,
                lineHeight: Math.round(22 * 1.4),
                name: "Quote Text",
                width: w - BRAND3.contentInset * 2 - avatarSize - 48
              }),
              vStack({
                name: "Citation",
                width: 300,
                height: 40,
                itemSpacing: 4,
                layoutSizingHorizontal: "FILL",
                layoutSizingVertical: "HUG",
                children: [
                  textNode({
                    text: props.name,
                    fontSize: 16,
                    fontWeight: 700,
                    fontColor: BRAND3.textPrimary,
                    name: "Citation Name"
                  }),
                  textNode({
                    text: props.title,
                    fontSize: 16,
                    fontWeight: 400,
                    fontColor: BRAND3.textSecondary,
                    name: "Citation Title"
                  })
                ]
              })
            ]
          })
        ]
      });
    }
  },
  kpi_cards: {
    zone: "brand_tinted",
    description: "Grid of KPI stat cards with label, brand-accent value, detail, and optional trend.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const kpis = props.kpis;
      const cardW = Math.floor((w - SLDS.spacingLarge * (kpis.length - 1)) / kpis.length);
      const cardNodes = kpis.map((kpi, i) => {
        const cardChildren = [
          textNode({
            text: kpi.label,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "KPI Label"
          }),
          textNode({
            text: kpi.value,
            fontSize: 28,
            fontWeight: 700,
            fontColor: BRAND3.accentRed,
            name: "KPI Value"
          }),
          textNode({
            text: kpi.detail,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "KPI Detail"
          })
        ];
        if (kpi.trend) {
          cardChildren.push(textNode({
            text: kpi.trend,
            fontSize: 12,
            fontWeight: 600,
            fontColor: kpi.trend.startsWith("+") ? "#059669" : SLDS.destructive,
            name: "KPI Trend"
          }));
        }
        return sldsCard({
          name: `KPI Card ${i + 1}`,
          width: cardW,
          children: cardChildren
        });
      });
      return hStack({
        name: "KPI Cards",
        width: w,
        height: 100,
        itemSpacing: SLDS.spacingLarge,
        layoutSizingVertical: "HUG",
        children: cardNodes
      });
    }
  },
  progress_card: {
    zone: "brand_tinted",
    description: "SLDS card with heading, a brand-accent progress bar, label, and optional detail.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const progress = Math.max(0, Math.min(100, props.progress ?? 0));
      const barWidth = w - SLDS.spacingLarge * 2;
      const filledWidth = Math.round(barWidth * (progress / 100));
      const cardChildren = [
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Progress Heading"
        }),
        hStack({
          name: "Progress Bar",
          width: barWidth,
          height: 8,
          fillColor: SLDS.border,
          cornerRadius: 4,
          layoutSizingHorizontal: "FILL",
          children: [
            {
              type: "rectangle",
              width: Math.max(filledWidth, 1),
              height: 8,
              fillColor: BRAND3.accentRed,
              cornerRadius: 4,
              name: "Progress Fill"
            }
          ]
        }),
        textNode({
          text: props.label,
          fontSize: SLDS.bodySize,
          fontWeight: 600,
          fontColor: SLDS.textPrimary,
          name: "Progress Label"
        })
      ];
      if (props.detail) {
        cardChildren.push(textNode({
          text: props.detail,
          fontSize: SLDS.bodySize,
          fontWeight: 400,
          fontColor: SLDS.textSecondary,
          name: "Progress Detail"
        }));
      }
      return sldsCard({
        name: "Progress Card",
        width: w,
        children: cardChildren
      });
    }
  },
  slds_data_table: {
    zone: "no_brand",
    description: "Standard data table with heading, column headers, placeholder body rows, and optional footer.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const columns = props.columns;
      const rowCount = props.rowCount ?? 5;
      const colW = Math.floor((w - SLDS.spacingLarge * 2) / columns.length);
      const headerCells = columns.map((col, i) => textNode({
        text: col,
        fontSize: SLDS.bodySize,
        fontWeight: 700,
        fontColor: SLDS.textPrimary,
        name: `Header ${col}`,
        width: colW
      }));
      const headerRow = hStack({
        name: "Header Row",
        width: w - SLDS.spacingLarge * 2,
        height: 40,
        fillColor: SLDS.surfaceSecondary,
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: SLDS.spacingMedium,
        paddingRight: SLDS.spacingMedium,
        counterAxisAlignItems: "CENTER",
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        children: headerCells
      });
      const bodyCellTemplate = {
        type: "frame",
        width: w - SLDS.spacingLarge * 2,
        height: 44,
        layoutMode: "HORIZONTAL",
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: SLDS.spacingMedium,
        paddingRight: SLDS.spacingMedium,
        counterAxisAlignItems: "CENTER",
        layoutSizingHorizontal: "FILL",
        layoutSizingVertical: "HUG",
        strokeColor: SLDS.border,
        strokeWeight: 1,
        name: "Table Row",
        children: columns.map((col, ci) => ({
          type: "text",
          text: "\u2014",
          fontSize: SLDS.bodySize,
          fontWeight: 400,
          fontColor: SLDS.textSecondary,
          name: `Cell ${col}`,
          width: colW
        }))
      };
      const rowData = Array.from({ length: rowCount }, (_, i) => ({ row: i + 1 }));
      const tableChildren = [
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Table Heading"
        }),
        headerRow,
        {
          $repeat: {
            data: rowData,
            template: bodyCellTemplate
          }
        }
      ];
      if (props.footer) {
        const footerChildren = [
          textNode({
            text: props.footer.label,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: props.footer.href ? SLDS.actionPrimary : SLDS.textSecondary,
            name: "Footer Link"
          })
        ];
        tableChildren.push(hStack({
          name: "Table Footer",
          width: w - SLDS.spacingLarge * 2,
          height: 40,
          paddingTop: SLDS.spacingSmall,
          paddingBottom: SLDS.spacingSmall,
          paddingLeft: SLDS.spacingMedium,
          paddingRight: SLDS.spacingMedium,
          primaryAxisAlignItems: "MAX",
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: footerChildren
        }));
      }
      return sldsCard({
        name: "Data Table",
        width: w,
        children: tableChildren
      });
    }
  },
  slds_checklist: {
    zone: "no_brand",
    description: "Numbered checklist with status badges (complete/current/pending), optional progress bar.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const items = props.items;
      const listChildren = [
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Checklist Heading"
        })
      ];
      if (props.progress !== undefined) {
        const barWidth = w - SLDS.spacingLarge * 2;
        const filledWidth = Math.round(barWidth * (props.progress / 100));
        listChildren.push(hStack({
          name: "Checklist Progress",
          width: barWidth,
          height: 6,
          fillColor: SLDS.border,
          cornerRadius: 3,
          layoutSizingHorizontal: "FILL",
          children: [
            {
              type: "rectangle",
              width: Math.max(filledWidth, 1),
              height: 6,
              fillColor: SLDS.actionPrimary,
              cornerRadius: 3,
              name: "Progress Fill"
            }
          ]
        }));
      }
      items.forEach((item, i) => {
        const isCurrent = item.status === "current";
        const itemChildren = [
          hStack({
            name: `Item ${i + 1} Header`,
            width: w - SLDS.spacingLarge * 2,
            height: 30,
            itemSpacing: SLDS.spacingSmall,
            counterAxisAlignItems: "CENTER",
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              textNode({
                text: `${i + 1}.`,
                fontSize: SLDS.bodySize,
                fontWeight: 700,
                fontColor: SLDS.textPrimary,
                name: "Step Number"
              }),
              textNode({
                text: item.title,
                fontSize: SLDS.bodySize,
                fontWeight: 600,
                fontColor: SLDS.textPrimary,
                name: "Item Title"
              }),
              statusBadge(item.status)
            ]
          }),
          textNode({
            text: item.description,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.textSecondary,
            name: "Item Description",
            width: w - SLDS.spacingLarge * 2 - 32
          })
        ];
        if (item.link) {
          itemChildren.push(textNode({
            text: item.link,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.actionPrimary,
            name: "Item Link"
          }));
        }
        const itemFrame = vStack({
          name: `Checklist Item ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 50,
          paddingTop: SLDS.spacingMedium,
          paddingBottom: SLDS.spacingMedium,
          paddingLeft: SLDS.spacingMedium,
          paddingRight: SLDS.spacingMedium,
          itemSpacing: 8,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          strokeColor: SLDS.border,
          strokeWeight: 1,
          children: itemChildren
        });
        if (isCurrent) {
          listChildren.push(hStack({
            name: `Item ${i + 1} (current)`,
            width: w - SLDS.spacingLarge * 2,
            height: 50,
            layoutSizingHorizontal: "FILL",
            layoutSizingVertical: "HUG",
            children: [
              {
                type: "rectangle",
                width: 4,
                height: 50,
                fillColor: SLDS.actionPrimary,
                name: "Current Accent"
              },
              itemFrame
            ]
          }));
        } else {
          listChildren.push(itemFrame);
        }
      });
      return sldsCard({
        name: "Checklist",
        width: w,
        children: listChildren
      });
    }
  },
  slds_card_list: {
    zone: "no_brand",
    description: "Stacked list items with optional icons, separated by SLDS borders.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const items = props.items;
      const listChildren = [
        textNode({
          text: props.heading,
          fontSize: SLDS.headingSmall,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "List Heading"
        })
      ];
      items.forEach((item, i) => {
        const rowChildren = [];
        if (item.icon) {
          rowChildren.push({
            type: "rectangle",
            width: 32,
            height: 32,
            fillColor: SLDS.surfaceSecondary,
            cornerRadius: SLDS.radius,
            name: `Icon ${item.icon}`
          });
        }
        const textBlock = vStack({
          name: `Item ${i + 1} Text`,
          width: w - SLDS.spacingLarge * 2 - (item.icon ? 56 : 0),
          height: 40,
          itemSpacing: 4,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: item.title,
              fontSize: SLDS.bodySize,
              fontWeight: 600,
              fontColor: SLDS.textPrimary,
              name: "Item Title"
            }),
            textNode({
              text: item.description,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Item Description",
              width: w - SLDS.spacingLarge * 2 - (item.icon ? 56 : 0)
            })
          ]
        });
        rowChildren.push(textBlock);
        if (item.link) {
          rowChildren.push(textNode({
            text: item.link,
            fontSize: SLDS.bodySize,
            fontWeight: 400,
            fontColor: SLDS.actionPrimary,
            name: "Item Link"
          }));
        }
        listChildren.push(hStack({
          name: `List Item ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 50,
          paddingTop: SLDS.spacingMedium,
          paddingBottom: SLDS.spacingMedium,
          itemSpacing: SLDS.spacingMedium,
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          strokeColor: i < items.length - 1 ? SLDS.border : undefined,
          strokeWeight: i < items.length - 1 ? 1 : undefined,
          children: rowChildren
        }));
      });
      return sldsCard({
        name: "Card List",
        width: w,
        children: listChildren
      });
    }
  },
  slds_alert: {
    zone: "no_brand",
    description: "Alert banner with type-specific color (warning/success/error/info), heading, body, and optional CTA.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const typeColors = {
        warning: "#f59e0b",
        success: "#059669",
        error: SLDS.destructive,
        info: SLDS.actionPrimary
      };
      const accentColor = typeColors[props.type] || SLDS.actionPrimary;
      const alertChildren = [
        {
          type: "rectangle",
          width: w,
          height: 4,
          fillColor: accentColor,
          name: "Alert Accent"
        },
        vStack({
          name: "Alert Content",
          width: w,
          height: 50,
          paddingTop: SLDS.spacingMedium,
          paddingBottom: SLDS.spacingMedium,
          paddingLeft: SLDS.spacingLarge,
          paddingRight: SLDS.spacingLarge,
          itemSpacing: 8,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: props.heading,
              fontSize: SLDS.bodySize,
              fontWeight: 700,
              fontColor: SLDS.textPrimary,
              name: "Alert Heading"
            }),
            textNode({
              text: props.body,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Alert Body",
              width: w - SLDS.spacingLarge * 2
            }),
            ...props.cta ? [
              textNode({
                text: props.cta,
                fontSize: SLDS.bodySize,
                fontWeight: 600,
                fontColor: SLDS.actionPrimary,
                name: "Alert CTA"
              })
            ] : []
          ]
        })
      ];
      return vStack({
        name: `Alert ${props.type}`,
        width: w,
        height: 50,
        fillColor: SLDS.surface,
        strokeColor: SLDS.border,
        strokeWeight: 1,
        cornerRadius: SLDS.radius,
        layoutSizingVertical: "HUG",
        clipsContent: true,
        children: alertChildren
      });
    }
  },
  slds_sidebar: {
    zone: "no_brand",
    description: "Quick actions sidebar card with stacked action links.",
    defaultWidth: 320,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const actions = props.actions;
      const actionNodes = actions.map((action, i) => {
        const rowChildren = [];
        if (action.icon) {
          rowChildren.push({
            type: "rectangle",
            width: 24,
            height: 24,
            fillColor: SLDS.surfaceSecondary,
            cornerRadius: SLDS.radius,
            name: `Icon ${action.icon}`
          });
        }
        rowChildren.push(vStack({
          name: `Action ${i + 1} Text`,
          width: w - SLDS.spacingLarge * 2 - (action.icon ? 40 : 0),
          height: 30,
          itemSpacing: 2,
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: action.title,
              fontSize: SLDS.bodySize,
              fontWeight: 600,
              fontColor: SLDS.actionPrimary,
              name: "Action Title"
            }),
            textNode({
              text: action.description,
              fontSize: 12,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Action Description",
              width: w - SLDS.spacingLarge * 2 - (action.icon ? 40 : 0)
            })
          ]
        }));
        return hStack({
          name: `Action ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 40,
          itemSpacing: SLDS.spacingMedium,
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "FILL",
          layoutSizingVertical: "HUG",
          strokeColor: i < actions.length - 1 ? SLDS.border : undefined,
          strokeWeight: i < actions.length - 1 ? 1 : undefined,
          paddingBottom: i < actions.length - 1 ? SLDS.spacingSmall : undefined,
          children: rowChildren
        });
      });
      return sldsCard({
        name: "Quick Actions Sidebar",
        width: w,
        children: [
          textNode({
            text: props.heading,
            fontSize: SLDS.headingSmall,
            fontWeight: 700,
            fontColor: SLDS.textPrimary,
            name: "Sidebar Heading"
          }),
          ...actionNodes
        ]
      });
    }
  },
  welcome_banner_slds: {
    zone: "no_brand",
    description: "Light welcome banner with greeting, subtitle, optional badge. Accent left border in SLDS blue.",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? this.defaultWidth;
      const contentChildren = [
        textNode({
          text: props.greeting,
          fontSize: SLDS.headingMedium,
          fontWeight: 700,
          fontColor: SLDS.textPrimary,
          name: "Greeting"
        }),
        textNode({
          text: props.subtitle,
          fontSize: SLDS.bodySize,
          fontWeight: 400,
          fontColor: SLDS.textSecondary,
          name: "Subtitle",
          width: w - SLDS.spacingLarge * 2 - 8
        })
      ];
      if (props.badge) {
        contentChildren.push(hStack({
          name: "Welcome Badge",
          width: 200,
          height: 40,
          itemSpacing: 8,
          counterAxisAlignItems: "CENTER",
          layoutSizingHorizontal: "HUG",
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: props.badge.value,
              fontSize: SLDS.headingLarge,
              fontWeight: 700,
              fontColor: SLDS.actionPrimary,
              name: "Badge Value"
            }),
            textNode({
              text: props.badge.label,
              fontSize: SLDS.bodySize,
              fontWeight: 400,
              fontColor: SLDS.textSecondary,
              name: "Badge Label"
            })
          ]
        }));
      }
      return sldsCard({
        name: "Welcome Banner",
        width: w,
        children: contentChildren,
        accentBorderLeft: SLDS.actionPrimary
      });
    }
  },
  slds_empty_state: {
    zone: "no_brand",
    description: "Empty state placeholder with heading, description, and CTA",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      return sldsCard({
        name: "Empty State",
        width: w,
        children: [
          textNode({ text: props.heading || "No items yet", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Empty Heading", width: w - SLDS.spacingLarge * 2 }),
          textNode({ text: props.description || "", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Empty Description", width: w - SLDS.spacingLarge * 2 }),
          ...props.primaryCta ? [{ type: "frame", name: "CTA Button", width: 160, height: 36, fillColor: SLDS.actionPrimary, cornerRadius: 4, layoutMode: "HORIZONTAL", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, children: [textNode({ text: props.primaryCta.text || "Get started", fontSize: SLDS.bodySize, fontWeight: 700, fontColor: SLDS.textInverse, name: "CTA Label" })] }] : []
        ]
      });
    }
  },
  quick_actions: {
    zone: "no_brand",
    description: "Grid of quick action cards with title and caption",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      const actions = props.actions || [];
      return sldsCard({
        name: "Quick Actions",
        width: w,
        children: [
          textNode({ text: props.heading || "Quick Actions", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Actions Heading" }),
          ...actions.map((a, i) => ({
            type: "frame",
            name: `Action ${i + 1}`,
            width: w - SLDS.spacingLarge * 2,
            height: 48,
            layoutMode: "VERTICAL",
            itemSpacing: 2,
            paddingTop: 10,
            paddingBottom: 10,
            strokeColor: SLDS.border,
            strokeWeight: 1,
            cornerRadius: 4,
            children: [
              textNode({ text: a.title || "", fontSize: SLDS.bodySize, fontWeight: 600, fontColor: SLDS.actionPrimary, name: "Action Title" }),
              textNode({ text: a.caption || a.description || "", fontSize: 12, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Action Caption" })
            ]
          }))
        ]
      });
    }
  },
  deadline_cards: {
    zone: "no_brand",
    description: "Stacked deadline/timeline cards with status indicators",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      return sldsCard({ name: "Deadline Cards", width: w, children: [
        textNode({ text: props.heading || "Upcoming Deadlines", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Deadlines Heading" }),
        textNode({ text: "Deadline items rendered here", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Deadlines Placeholder" })
      ] });
    }
  },
  activity_feed: {
    zone: "no_brand",
    description: "Chronological activity feed with timestamps",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      return sldsCard({ name: "Activity Feed", width: w, children: [
        textNode({ text: props.heading || "Recent Activity", fontSize: SLDS.headingSmall, fontWeight: 700, fontColor: SLDS.textPrimary, name: "Feed Heading" }),
        ...props.viewAllLink ? [textNode({ text: props.viewAllLink.text || "View All", fontSize: 12, fontWeight: 600, fontColor: SLDS.actionPrimary, name: "View All Link" })] : [],
        textNode({ text: "Activity items rendered here", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textSecondary, name: "Feed Placeholder" })
      ] });
    }
  },
  psm_contact_card: {
    zone: "full_brand",
    description: "Partner Success Manager contact card with quote and CTA",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      return {
        type: "frame",
        name: "PSM Contact",
        width: w,
        height: 200,
        fillColor: BRAND3.bgDark,
        layoutMode: "HORIZONTAL",
        itemSpacing: 24,
        paddingTop: 40,
        paddingBottom: 40,
        paddingLeft: BRAND3.contentInset,
        paddingRight: BRAND3.contentInset,
        children: [
          { type: "rectangle", name: "PSM Avatar", width: 80, height: 80, fillColor: BRAND3.accentPurple, cornerRadius: 40 },
          { type: "frame", name: "PSM Info", width: w - BRAND3.contentInset * 2 - 104, height: 120, layoutMode: "VERTICAL", itemSpacing: 8, children: [
            textNode({ text: props.psmName || "Your Partner Success Manager", fontSize: 18, fontWeight: 700, fontColor: BRAND3.textPrimary, name: "PSM Name" }),
            textNode({ text: props.message || props.attribution || "", fontSize: 14, fontWeight: 400, fontColor: BRAND3.textSecondary, name: "PSM Message", width: w - BRAND3.contentInset * 2 - 128 }),
            ...props.cta ? [textNode({ text: props.cta.text || "Send message", fontSize: 14, fontWeight: 600, fontColor: BRAND3.accentRed, name: "PSM CTA" })] : []
          ] }
        ]
      };
    }
  },
  slds_alert_list: {
    zone: "no_brand",
    description: "Multiple stacked alert banners",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      const alerts = props.alerts || [];
      const alertColors = { warning: "#f59e0b", success: "#059669", error: "#ba0517", info: SLDS.actionPrimary };
      return {
        type: "frame",
        name: "Alert List",
        width: w,
        height: alerts.length * 60 + 16,
        layoutMode: "VERTICAL",
        itemSpacing: 8,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: SLDS.spacingLarge,
        paddingRight: SLDS.spacingLarge,
        children: alerts.map((a, i) => ({
          type: "frame",
          name: `Alert ${i + 1}`,
          width: w - SLDS.spacingLarge * 2,
          height: 48,
          fillColor: SLDS.surface,
          strokeColor: alertColors[a.variant] || SLDS.border,
          strokeWeight: 1,
          cornerRadius: SLDS.radius,
          layoutMode: "HORIZONTAL",
          itemSpacing: 8,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          children: [
            { type: "rectangle", name: "Alert Accent", width: 4, height: 24, fillColor: alertColors[a.variant] || SLDS.actionPrimary },
            textNode({ text: a.text || "", fontSize: SLDS.bodySize, fontWeight: 400, fontColor: SLDS.textPrimary, name: "Alert Text", width: w - SLDS.spacingLarge * 2 - 52 })
          ]
        }))
      };
    }
  },
  notification_banner: {
    zone: "no_brand",
    description: "System notification banner with heading, description, and CTA",
    defaultWidth: 1440,
    buildTree(props, width) {
      const w = width ?? 1440;
      const bannerColors = {
        mfa_nag: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
        countersign_success: { bg: "#d1fae5", border: "#34d399", text: "#065f46" },
        default: { bg: SLDS.surface, border: SLDS.border, text: SLDS.textPrimary }
      };
      const colors = bannerColors[props.bannerType] || bannerColors.default;
      return {
        type: "frame",
        name: `Banner ${props.bannerType || "default"}`,
        width: w,
        height: 60,
        fillColor: colors.bg,
        strokeColor: colors.border,
        strokeWeight: 1,
        cornerRadius: 8,
        layoutMode: "HORIZONTAL",
        itemSpacing: 12,
        paddingTop: 14,
        paddingBottom: 14,
        paddingLeft: 20,
        paddingRight: 20,
        counterAxisAlignItems: "CENTER",
        children: [
          { type: "rectangle", name: "Banner Accent", width: 4, height: 32, fillColor: colors.border },
          { type: "frame", name: "Banner Content", width: w - 100, height: 32, layoutMode: "VERTICAL", itemSpacing: 2, children: [
            textNode({ text: props.heading || "", fontSize: 13, fontWeight: 700, fontColor: colors.text, name: "Banner Heading" })
          ] },
          ...props.cta ? [{
            type: "frame",
            name: "Banner CTA",
            width: 100,
            height: 28,
            fillColor: colors.border,
            cornerRadius: 4,
            layoutMode: "HORIZONTAL",
            primaryAxisAlignItems: "CENTER",
            counterAxisAlignItems: "CENTER",
            paddingLeft: 12,
            paddingRight: 12,
            children: [
              textNode({ text: props.cta.text || "Action", fontSize: 12, fontWeight: 700, fontColor: "#ffffff", name: "CTA Label" })
            ]
          }] : []
        ]
      };
    }
  }
};
var TEMPLATE_PROPS = {
  hero_takeover: {
    required: ["heading"],
    optional: ["overline", "body", "cta: {label, color?}", "persona", "height"]
  },
  metrics_bar: {
    required: ["metrics: Array<{value, qualifier, meta}>"],
    optional: ["containerRadius"]
  },
  article_deck_3up: {
    required: ["articles: Array<{title, body, media?}>"],
    optional: ["heading"]
  },
  bold_cta: {
    required: ["heading", "cta: {label, color?}"],
    optional: ["body"]
  },
  global_highlights: {
    required: ["cards: Array<{title, body, stat, statLabel}>"],
    optional: []
  },
  avatar_quotation: {
    required: ["quote", "name", "title"],
    optional: ["size"]
  },
  kpi_cards: {
    required: ["kpis: Array<{label, value, detail, trend?}>"],
    optional: []
  },
  progress_card: {
    required: ["heading", "progress", "label"],
    optional: ["detail"]
  },
  slds_data_table: {
    required: ["heading", "columns: string[]"],
    optional: ["rowCount", "footer: {label, href?}"]
  },
  slds_checklist: {
    required: ["heading", "items: Array<{title, description, status, link?}>"],
    optional: ["progress"]
  },
  slds_card_list: {
    required: ["heading", "items: Array<{icon?, title, description, link?}>"],
    optional: []
  },
  slds_alert: {
    required: ["type: 'warning'|'success'|'error'|'info'", "heading", "body"],
    optional: ["cta"]
  },
  slds_sidebar: {
    required: ["heading", "actions: Array<{icon?, title, description}>"],
    optional: []
  },
  welcome_banner_slds: {
    required: ["greeting", "subtitle"],
    optional: ["badge: {value, label}"]
  },
  slds_empty_state: {
    required: ["heading", "description"],
    optional: ["primaryCta: {text, href?}", "secondaryCta: {text, href?}"]
  },
  quick_actions: {
    required: ["actions: Array<{title, caption|description}>"],
    optional: ["heading"]
  },
  deadline_cards: {
    required: [],
    optional: ["heading"]
  },
  activity_feed: {
    required: [],
    optional: ["heading", "viewAllLink: {text, href?}", "rows"]
  },
  psm_contact_card: {
    required: [],
    optional: ["psmName", "message", "attribution", "cta: {text, href?}"]
  },
  slds_alert_list: {
    required: ["alerts: Array<{variant, text}>"],
    optional: []
  },
  notification_banner: {
    required: ["heading"],
    optional: ["bannerType: 'mfa_nag'|'countersign_success'|'default'", "cta: {text, href?}"]
  }
};
function getTemplateSummaries() {
  return Object.entries(SECTION_TEMPLATES).map(([name, tmpl]) => {
    const propInfo = TEMPLATE_PROPS[name] || { required: [], optional: [] };
    return {
      name,
      zone: tmpl.zone,
      description: tmpl.description,
      defaultWidth: tmpl.defaultWidth,
      requiredProps: propInfo.required,
      optionalProps: propInfo.optional
    };
  });
}

// src/claude_to_figma_mcp/tools/page-compiler.ts
function registerTools22(server, sendCommandToFigma2) {
  server.tool("build_page_section", "Build a single page section in Figma using a compact semantic spec. Accepts a template name and props \u2014 the server handles zone-aware token selection, node tree generation, and dispatches via create_node_tree internally. ~10x fewer tokens than manual create_node_tree calls. Use get_section_templates to see available templates and their required props.", {
    template: z2.string().describe("Template name (e.g., 'hero_takeover', 'slds_data_table')"),
    parentId: z2.string().describe("Parent frame ID to add the section into"),
    props: z2.record(z2.any()).describe("Template-specific properties \u2014 see get_section_templates for schema"),
    width: z2.number().optional().describe("Override the template's default section width"),
    insertAt: z2.number().optional().describe("Position index within parent's children (omit to append)")
  }, async ({ template, parentId, props, width, insertAt }) => {
    try {
      const tmpl = SECTION_TEMPLATES[template];
      if (!tmpl) {
        const available = Object.keys(SECTION_TEMPLATES).join(", ");
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Unknown template "${template}". Available templates: ${available}`
            })
          }]
        };
      }
      const tree = tmpl.buildTree(props, width);
      logger.info(`build_page_section: template="${template}" zone="${tmpl.zone}" ` + `parentId="${parentId}" width=${width ?? tmpl.defaultWidth}`);
      const params = { tree, parentId };
      if (insertAt !== undefined) {
        params.insertAt = insertAt;
      }
      const result = await sendCommandWithRetry("create_node_tree", params, { timeoutMs: 60000 });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            template,
            zone: tmpl.zone,
            result
          })
        }]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`build_page_section error: ${message}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Failed to build section "${template}": ${message}`
          })
        }]
      };
    }
  });
  server.tool("get_section_templates", "List available section templates for build_page_section, grouped by zone. Returns template names, zones, descriptions, default widths, and required/optional props for each template.", {}, async () => {
    const summaries = getTemplateSummaries();
    const grouped = {
      full_brand: [],
      brand_tinted: [],
      no_brand: []
    };
    for (const s of summaries) {
      grouped[s.zone].push(s);
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalTemplates: summaries.length,
          zones: grouped
        }, null, 2)
      }]
    };
  });
}

// src/claude_to_figma_mcp/tools/events.ts
function registerTools23(server, sendCommandToFigma2) {
  server.tool("figma_events_subscribe", "Start or stop receiving Figma design events (selection changes, node mutations, page switches). Events accumulate in a buffer and are read with figma_events_poll.", {
    enabled: z2.boolean().describe("true to start streaming, false to stop")
  }, async ({ enabled }) => {
    try {
      if (enabled) {
        const result = await sendCommandToFigma2("subscribe_events", {});
        if (result && result.success) {
          setSubscribed(true);
          return {
            content: [{ type: "text", text: "Event streaming started. Use figma_events_poll to read events." }]
          };
        }
        return {
          content: [{ type: "text", text: "Failed to start event streaming on the Figma side." }]
        };
      } else {
        try {
          await sendCommandToFigma2("unsubscribe_events", {});
          return {
            content: [{ type: "text", text: "Event streaming stopped." }]
          };
        } finally {
          setSubscribed(false);
        }
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  });
  server.tool("figma_events_poll", "Read buffered Figma design events. Returns events accumulated since last poll (or since subscribe). Events are drained from the buffer unless peek is true.", {
    peek: z2.boolean().optional().describe("If true, read events without clearing them from the buffer"),
    eventTypes: z2.array(z2.enum(["selectionchange", "nodechange", "currentpagechange"])).optional().describe("Only return events of these types"),
    since: z2.number().optional().describe("Only return events after this timestamp (ms epoch)"),
    limit: z2.number().int().positive().optional().describe("Max number of events to return (most recent)"),
    excludePluginOperations: z2.boolean().optional().describe("If true, filter out events caused by plugin commands")
  }, async ({ peek, eventTypes, since, limit, excludePluginOperations }) => {
    const active = isSubscribed();
    const events = pollEvents({ peek, eventTypes, since, limit, excludePluginOperations });
    if (!active && events.length === 0) {
      return {
        content: [{ type: "text", text: "Not subscribed to events. Call figma_events_subscribe first." }]
      };
    }
    if (events.length === 0) {
      return {
        content: [{ type: "text", text: `No events in buffer. (Buffer size: ${getBufferSize()})` }]
      };
    }
    const prefix = active ? "" : `[Note: not currently subscribed \u2014 returning buffered events from before disconnect]
`;
    return {
      content: [{ type: "text", text: prefix + JSON.stringify(events, null, 2) }]
    };
  });
}

// src/claude_to_figma_mcp/tools/prompts.ts
function registerPrompts(server) {
  server.prompt("design_strategy", "Best practices for working with Figma designs", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `When working with Figma designs, follow these best practices:

1. Start with Document Structure:
   - First use get_document_info() to understand the current document
   - Plan your layout hierarchy before creating elements
   - Create a main container frame for each screen/section

2. Naming Conventions:
   - Use descriptive, semantic names for all elements
   - Follow a consistent naming pattern (e.g., "Login Screen", "Logo Container", "Email Input")
   - Group related elements with meaningful names

3. Layout Hierarchy:
   - Create parent frames first, then add child elements
   - For forms/login screens:
     * Start with the main screen container frame
     * Create a logo container at the top
     * Group input fields in their own containers
     * Place action buttons (login, submit) after inputs
     * Add secondary elements (forgot password, signup links) last

4. Input Fields Structure:
   - Create a container frame for each input field
   - Include a label text above or inside the input
   - Group related inputs (e.g., username/password) together

5. Element Creation:
   - Use create_frame() for containers and input fields
   - Use create_text() for labels, buttons text, and links
   - Set appropriate colors and styles:
     * Use fillColor for backgrounds
     * Use strokeColor for borders
     * Set proper fontWeight for different text elements

6. Mofifying existing elements:
  - use set_text_content() to modify text content.

7. Visual Hierarchy:
   - Position elements in logical reading order (top to bottom)
   - Maintain consistent spacing between elements
   - Use appropriate font sizes for different text types:
     * Larger for headings/welcome text
     * Medium for input labels
     * Standard for button text
     * Smaller for helper text/links

8. Best Practices:
   - Verify each creation with get_node_info()
   - Use parentId to maintain proper hierarchy
   - Group related elements together in frames
   - Keep consistent spacing and alignment

Example Login Screen Structure:
- Login Screen (main frame)
  - Logo Container (frame)
    - Logo (image/text)
  - Welcome Text (text)
  - Input Container (frame)
    - Email Input (frame)
      - Email Label (text)
      - Email Field (frame)
    - Password Input (frame)
      - Password Label (text)
      - Password Field (frame)
  - Login Button (frame)
    - Button Text (text)
  - Helper Links (frame)
    - Forgot Password (text)
    - Don't have account (text)`
          }
        }
      ],
      description: "Best practices for working with Figma designs"
    };
  });
  server.prompt("read_design_strategy", "Best practices for reading Figma designs", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use read_my_design() to understand the current selection
   - If no selection ask user to select single or multiple nodes
`
          }
        }
      ],
      description: "Best practices for reading Figma designs"
    };
  });
  server.prompt("text_replacement_strategy", "Systematic approach for replacing text in Figma designs", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Intelligent Text Replacement Strategy

## 1. Analyze Design & Identify Structure
- Scan text nodes to understand the overall structure of the design
- Use AI pattern recognition to identify logical groupings:
  * Tables (rows, columns, headers, cells)
  * Lists (items, headers, nested lists)
  * Card groups (similar cards with recurring text fields)
  * Forms (labels, input fields, validation text)
  * Navigation (menu items, breadcrumbs)
\`\`\`
scan_text_nodes(nodeId: "node-id")
get_node_info(nodeId: "node-id")  // optional
\`\`\`

## 2. Strategic Chunking for Complex Designs
- Divide replacement tasks into logical content chunks based on design structure
- Use one of these chunking strategies that best fits the design:
  * **Structural Chunking**: Table rows/columns, list sections, card groups
  * **Spatial Chunking**: Top-to-bottom, left-to-right in screen areas
  * **Semantic Chunking**: Content related to the same topic or functionality
  * **Component-Based Chunking**: Process similar component instances together

## 3. Progressive Replacement with Verification
- Create a safe copy of the node for text replacement
- Replace text chunk by chunk with continuous progress updates
- After each chunk is processed:
  * Export that section as a small, manageable image
  * Verify text fits properly and maintain design integrity
  * Fix issues before proceeding to the next chunk

\`\`\`
// Clone the node to create a safe copy
clone_node(nodeId: "selected-node-id", x: [new-x], y: [new-y])

// Replace text chunk by chunk
set_multiple_text_contents(
  nodeId: "parent-node-id",
  text: [
    { nodeId: "node-id-1", text: "New text 1" },
    // More nodes in this chunk...
  ]
)

// Verify chunk with small, targeted image exports
export_node_as_image(nodeId: "chunk-node-id", format: "PNG", scale: 0.5)
\`\`\`

## 4. Intelligent Handling for Table Data
- For tabular content:
  * Process one row or column at a time
  * Maintain alignment and spacing between cells
  * Consider conditional formatting based on cell content
  * Preserve header/data relationships

## 5. Smart Text Adaptation
- Adaptively handle text based on container constraints:
  * Auto-detect space constraints and adjust text length
  * Apply line breaks at appropriate linguistic points
  * Maintain text hierarchy and emphasis
  * Consider font scaling for critical content that must fit

## 6. Progressive Feedback Loop
- Establish a continuous feedback loop during replacement:
  * Real-time progress updates (0-100%)
  * Small image exports after each chunk for verification
  * Issues identified early and resolved incrementally
  * Quick adjustments applied to subsequent chunks

## 7. Final Verification & Context-Aware QA
- After all chunks are processed:
  * Export the entire design at reduced scale for final verification
  * Check for cross-chunk consistency issues
  * Verify proper text flow between different sections
  * Ensure design harmony across the full composition

## 8. Chunk-Specific Export Scale Guidelines
- Scale exports appropriately based on chunk size:
  * Small chunks (1-5 elements): scale 1.0
  * Medium chunks (6-20 elements): scale 0.7
  * Large chunks (21-50 elements): scale 0.5
  * Very large chunks (50+ elements): scale 0.3
  * Full design verification: scale 0.2

## Sample Chunking Strategy for Common Design Types

### Tables
- Process by logical rows (5-10 rows per chunk)
- Alternative: Process by column for columnar analysis
- Tip: Always include header row in first chunk for reference

### Card Lists
- Group 3-5 similar cards per chunk
- Process entire cards to maintain internal consistency
- Verify text-to-image ratio within cards after each chunk

### Forms
- Group related fields (e.g., "Personal Information", "Payment Details")
- Process labels and input fields together
- Ensure validation messages and hints are updated with their fields

### Navigation & Menus
- Process hierarchical levels together (main menu, submenu)
- Respect information architecture relationships
- Verify menu fit and alignment after replacement

## Best Practices
- **Preserve Design Intent**: Always prioritize design integrity
- **Structural Consistency**: Maintain alignment, spacing, and hierarchy
- **Visual Feedback**: Verify each chunk visually before proceeding
- **Incremental Improvement**: Learn from each chunk to improve subsequent ones
- **Balance Automation & Control**: Let AI handle repetitive replacements but maintain oversight
- **Respect Content Relationships**: Keep related content consistent across chunks

Remember that text is never just text\u2014it's a core design element that must work harmoniously with the overall composition. This chunk-based strategy allows you to methodically transform text while maintaining design integrity.`
          }
        }
      ],
      description: "Systematic approach for replacing text in Figma designs"
    };
  });
  server.prompt("annotation_conversion_strategy", "Strategy for converting manual annotations to Figma's native annotations", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Automatic Annotation Conversion

## Process Overview

The process of converting manual annotations (numbered/alphabetical indicators with connected descriptions) to Figma's native annotations:

1. Get selected frame/component information
2. Scan and collect all annotation text nodes
3. Scan target UI elements (components, instances, frames)
4. Match annotations to appropriate UI elements
5. Apply native Figma annotations

## Step 1: Get Selection and Initial Setup

First, get the selected frame or component that contains annotations:

\`\`\`typescript
// Get the selected frame/component
const selection = await get_selection();
const selectedNodeId = selection[0].id

// Get available annotation categories for later use
const annotationData = await get_annotations({
  nodeId: selectedNodeId,
  includeCategories: true
});
const categories = annotationData.categories;
\`\`\`

## Step 2: Scan Annotation Text Nodes

Scan all text nodes to identify annotations and their descriptions:

\`\`\`typescript
// Get all text nodes in the selection
const textNodes = await scan_text_nodes({
  nodeId: selectedNodeId
});

// Filter and group annotation markers and descriptions

// Markers typically have these characteristics:
// - Short text content (usually single digit/letter)
// - Specific font styles (often bold)
// - Located in a container with "Marker" or "Dot" in the name
// - Have a clear naming pattern (e.g., "1", "2", "3" or "A", "B", "C")


// Identify description nodes
// Usually longer text nodes near markers or with matching numbers in path

\`\`\`

## Step 3: Scan Target UI Elements

Get all potential target elements that annotations might refer to:

\`\`\`typescript
// Scan for all UI elements that could be annotation targets
const targetNodes = await scan_nodes_by_types({
  nodeId: selectedNodeId,
  types: [
    "COMPONENT",
    "INSTANCE",
    "FRAME"
  ]
});
\`\`\`

## Step 4: Match Annotations to Targets

Match each annotation to its target UI element using these strategies in order of priority:

1. **Path-Based Matching**:
   - Look at the marker's parent container name in the Figma layer hierarchy
   - Remove any "Marker:" or "Annotation:" prefixes from the parent name
   - Find UI elements that share the same parent name or have it in their path
   - This works well when markers are grouped with their target elements

2. **Name-Based Matching**:
   - Extract key terms from the annotation description
   - Look for UI elements whose names contain these key terms
   - Consider both exact matches and semantic similarities
   - Particularly effective for form fields, buttons, and labeled components

3. **Proximity-Based Matching** (fallback):
   - Calculate the center point of the marker
   - Find the closest UI element by measuring distances to element centers
   - Consider the marker's position relative to nearby elements
   - Use this method when other matching strategies fail

Additional Matching Considerations:
- Give higher priority to matches found through path-based matching
- Consider the type of UI element when evaluating matches
- Take into account the annotation's context and content
- Use a combination of strategies for more accurate matching

## Step 5: Apply Native Annotations

Convert matched annotations to Figma's native annotations using batch processing:

\`\`\`typescript
// Prepare annotations array for batch processing
const annotationsToApply = Object.values(annotations).map(({ marker, description }) => {
  // Find target using multiple strategies
  const target =
    findTargetByPath(marker, targetNodes) ||
    findTargetByName(description, targetNodes) ||
    findTargetByProximity(marker, targetNodes);

  if (target) {
    // Determine appropriate category based on content
    const category = determineCategory(description.characters, categories);

    // Determine appropriate additional annotationProperty based on content
    const annotationProperty = determineProperties(description.characters, target.type);

    return {
      nodeId: target.id,
      labelMarkdown: description.characters,
      categoryId: category.id,
      properties: annotationProperty
    };
  }
  return null;
}).filter(Boolean); // Remove null entries

// Apply annotations in batches using set_multiple_annotations
if (annotationsToApply.length > 0) {
  await set_multiple_annotations({
    nodeId: selectedNodeId,
    annotations: annotationsToApply
  });
}
\`\`\`


This strategy focuses on practical implementation based on real-world usage patterns, emphasizing the importance of handling various UI elements as annotation targets, not just text nodes.`
          }
        }
      ],
      description: "Strategy for converting manual annotations to Figma's native annotations"
    };
  });
  server.prompt("swap_overrides_instances", "Guide to swap instance overrides between instances", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Swap Component Instance and Override Strategy

## Overview
This strategy enables transferring content and property overrides from a source instance to one or more target instances in Figma, maintaining design consistency while reducing manual work.

## Step-by-Step Process

### 1. Selection Analysis
- Use \`get_selection()\` to identify the parent component or selected instances
- For parent components, scan for instances with \`scan_nodes_by_types({ nodeId: "parent-id", types: ["INSTANCE"] })\`
- Identify custom slots by name patterns (e.g. "Custom Slot*" or "Instance Slot") or by examining text content
- Determine which is the source instance (with content to copy) and which are targets (where to apply content)

### 2. Extract Source Overrides
- Use \`get_instance_overrides()\` to extract customizations from the source instance
- This captures text content, property values, and style overrides
- Command syntax: \`get_instance_overrides({ nodeId: "source-instance-id" })\`
- Look for successful response like "Got component information from [instance name]"

### 3. Apply Overrides to Targets
- Apply captured overrides using \`set_instance_overrides()\`
- Command syntax:
  \`\`\`
  set_instance_overrides({
    sourceInstanceId: "source-instance-id",
    targetNodeIds: ["target-id-1", "target-id-2", ...]
  })
  \`\`\`

### 4. Verification
- Verify results with \`get_node_info()\` or \`read_my_design()\`
- Confirm text content and style overrides have transferred successfully

## Key Tips
- Tools auto-join the connected Figma file; call \`join_channel()\` only when several files are connected
- When working with multiple targets, check the full selection with \`get_selection()\`
- Preserve component relationships by using instance overrides rather than direct text manipulation`
          }
        }
      ],
      description: "Strategy for transferring overrides between component instances in Figma"
    };
  });
  server.prompt("component_migration_strategy", "Strategy for migrating component instances when design system components are updated", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Component Migration Strategy

## Overview
When design system components are updated (structural changes, renamed layers, new properties, variable restructuring), Figma's native update propagation often breaks overrides. This strategy uses AI-driven migration to intelligently swap instances while preserving customizations.

## 6-Step Migration Workflow

### 1. Understand \u2014 Identify old and new components
\`\`\`
get_local_components()
\`\`\`
- Identify the old component (source) and new component (target)
- Note their node IDs for the next steps

### 2. Diff \u2014 Compare component versions
\`\`\`
diff_components(sourceId: "old-component-id", targetId: "new-component-id")
\`\`\`
- Review the mapping: check confidence scores and match types
- Look at unmappedSource (properties that will be lost) and unmappedTarget (new properties)
- If the auto-mapping is wrong, re-run with manualMappings to correct specific entries
- Pay attention to structural changes (depth, wrapper frames)

### 3. Test \u2014 Preview migration on a single instance
\`\`\`
migrate_instance(
  instanceId: "one-instance-id",
  targetComponentId: "new-component-id",
  propertyMapping: { ...mapping from step 2... },
  dryRun: true
)
\`\`\`
- Review overridesToApply to confirm correct values will be transferred
- Check unmappedKeys for any overrides that will be lost

### 4. Apply One \u2014 Migrate a single instance and verify
\`\`\`
migrate_instance(
  instanceId: "one-instance-id",
  targetComponentId: "new-component-id",
  propertyMapping: { ...mapping from step 2... }
)
\`\`\`
- Verify visually: \`export_node_as_image(nodeId: "migrated-instance-id")\`
- Check that text, colors, visibility, and nested instances transferred correctly

### 5. Batch Preview \u2014 Review full migration scope
\`\`\`
batch_migrate(
  sourceComponentName: "OldButton",
  targetComponentId: "new-component-id",
  propertyMapping: { ...mapping... },
  dryRun: true
)
\`\`\`
- Review total instance count
- Use parentId to scope to specific frames if needed
- Use limit to migrate in smaller batches for large files

### 6. Batch Apply \u2014 Migrate all instances
\`\`\`
batch_migrate(
  sourceComponentName: "OldButton",
  targetComponentId: "new-component-id",
  propertyMapping: { ...mapping... }
)
\`\`\`
- Verify a sample with \`export_node_as_image\` on a few migrated instances
- Check for any failures in the results

## Key Considerations

- **Variable bindings**: introspect now reports \`boundVariableName\` (e.g., "Colors/Primary") \u2014 use this to verify token bindings are preserved
- **Nested instances**: Instances inside other instances use swapComponent instead of delete+create \u2014 overrides are applied the same way
- **Confidence scores**: Mappings below 0.6 confidence should be reviewed manually
- **Component properties**: Properties exposed on the component API (booleans, text, instance swaps) are mapped through the same system
- **Partial migration**: Use limit + parentId for incremental migration across large files`
          }
        }
      ],
      description: "Strategy for migrating component instances when design system components are updated"
    };
  });
  server.prompt("reaction_to_connector_strategy", "Strategy for converting Figma prototype reactions to connector lines using the output of 'get_reactions'", (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Strategy: Convert Figma Prototype Reactions to Connector Lines

## Goal
Process the JSON output from the \`get_reactions\` tool to generate an array of connection objects suitable for the \`create_connections\` tool. This visually represents prototype flows as connector lines on the Figma canvas.

## Input Data
You will receive JSON data from the \`get_reactions\` tool. This data contains an array of nodes, each with potential reactions. A typical reaction object looks like this:
\`\`\`json
{
  "trigger": { "type": "ON_CLICK" },
  "action": {
    "type": "NAVIGATE",
    "destinationId": "destination-node-id",
    "navigationTransition": { ... },
    "preserveScrollPosition": false
  }
}
\`\`\`

## Step-by-Step Process

### 1. Preparation & Context Gathering
   - **Action:** Call \`read_my_design\` on the relevant node(s) to get context about the nodes involved (names, types, etc.). This helps in generating meaningful connector labels later.
   - **Action:** Call \`set_default_connector\` **without** the \`connectorId\` parameter.
   - **Check Result:** Analyze the response from \`set_default_connector\`.
     - If it confirms a default connector is already set (e.g., "Default connector is already set"), proceed to Step 2.
     - If it indicates no default connector is set (e.g., "No default connector set..."), you **cannot** proceed with \`create_connections\` yet. Inform the user they need to manually copy a connector from FigJam, paste it onto the current page, select it, and then you can run \`set_default_connector({ connectorId: "SELECTED_NODE_ID" })\` before attempting \`create_connections\`. **Do not proceed to Step 2 until a default connector is confirmed.**

### 2. Filter and Transform Reactions from \`get_reactions\` Output
   - **Iterate:** Go through the JSON array provided by \`get_reactions\`. For each node in the array:
     - Iterate through its \`reactions\` array.
   - **Filter:** Keep only reactions where the \`action\` meets these criteria:
     - Has a \`type\` that implies a connection (e.g., \`NAVIGATE\`, \`OPEN_OVERLAY\`, \`SWAP_OVERLAY\`). **Ignore** types like \`CHANGE_TO\`, \`CLOSE_OVERLAY\`, etc.
     - Has a valid \`destinationId\` property.
   - **Extract:** For each valid reaction, extract the following information:
     - \`sourceNodeId\`: The ID of the node the reaction belongs to (from the outer loop).
     - \`destinationNodeId\`: The value of \`action.destinationId\`.
     - \`actionType\`: The value of \`action.type\`.
     - \`triggerType\`: The value of \`trigger.type\`.

### 3. Generate Connector Text Labels
   - **For each extracted connection:** Create a concise, descriptive text label string.
   - **Combine Information:** Use the \`actionType\`, \`triggerType\`, and potentially the names of the source/destination nodes (obtained from Step 1's \`read_my_design\` or by calling \`get_node_info\` if necessary) to generate the label.
   - **Example Labels:**
     - If \`triggerType\` is "ON_CLICK" and \`actionType\` is "NAVIGATE": "On click, navigate to [Destination Node Name]"
     - If \`triggerType\` is "ON_DRAG" and \`actionType\` is "OPEN_OVERLAY": "On drag, open [Destination Node Name] overlay"
   - **Keep it brief and informative.** Let this generated string be \`generatedText\`.

### 4. Prepare the \`connections\` Array for \`create_connections\`
   - **Structure:** Create a JSON array where each element is an object representing a connection.
   - **Format:** Each object in the array must have the following structure:
     \`\`\`json
     {
       "startNodeId": "sourceNodeId_from_step_2",
       "endNodeId": "destinationNodeId_from_step_2",
       "text": "generatedText_from_step_3"
     }
     \`\`\`
   - **Result:** This final array is the value you will pass to the \`connections\` parameter when calling the \`create_connections\` tool.

### 5. Execute Connection Creation
   - **Action:** Call the \`create_connections\` tool, passing the array generated in Step 4 as the \`connections\` argument.
   - **Verify:** Check the response from \`create_connections\` to confirm success or failure.

This detailed process ensures you correctly interpret the reaction data, prepare the necessary information, and use the appropriate tools to create the connector lines.`
          }
        }
      ],
      description: "Strategy for converting Figma prototype reactions to connector lines using the output of 'get_reactions'"
    };
  });
}

// src/claude_to_figma_mcp/tools/setup.ts
function registerSetupTools(server) {
  server.tool("setup_status", "Check the claude-to-figma connection: whether the relay is running (starting it when installed as a Claude Code plugin), which Figma files have the plugin open, and where the Figma plugin manifest is for importing into Figma. Use it when setting up or when a Figma tool reports it isn't connected.", {}, async () => {
    const relay = await ensureRelay(3055);
    let files = [];
    let channelError;
    if (relay) {
      try {
        files = await listChannels();
      } catch (error) {
        channelError = error instanceof Error ? error.message : String(error);
      }
    }
    const manifest = figmaPluginManifestPath();
    const next = !relay ? "Start the relay: `bun socket` in the claude-to-figma repo (the plugin version starts it automatically; it needs Bun)." : channelError ? channelError : files.length === 0 ? `Open a file in the Figma desktop app and run Plugins \u2192 Development \u2192 Claude to Figma Plugin.${manifest ? ` If it isn't listed, import it first: Plugins \u2192 Development \u2192 Import plugin from manifest\u2026 \u2192 ${manifest}` : ""}` : files.length === 1 ? "Ready. Figma tools will use the open file." : "Several files have the plugin open. Ask the user which one, then call join_channel with its channel name.";
    const status = {
      installedAsClaudeCodePlugin: isPluginInstall,
      relayRunning: relay,
      connectedFigmaFiles: files.map((f) => f.name),
      figmaPluginManifest: manifest ?? "src/claude_figma_plugin/manifest.json in the claude-to-figma repo",
      next
    };
    return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
  });
}

// src/claude_to_figma_mcp/server.ts
var server = new McpServer({
  name: "ClaudeToFigmaMCP",
  version: "1.0.0"
});
registerTools(server, sendCommandToFigma);
registerTools2(server, sendCommandToFigma);
registerTools3(server, sendCommandToFigma);
registerTools4(server, sendCommandToFigma);
registerTools5(server, sendCommandToFigma);
registerTools6(server, sendCommandToFigma);
registerTools7(server, sendCommandToFigma);
registerTools8(server, sendCommandToFigma);
registerTools9(server, sendCommandToFigma);
registerTools10(server, sendCommandToFigma);
registerTools11(server, sendCommandToFigma);
registerTools12(server, sendCommandToFigma);
registerTools13(server, sendCommandToFigma);
registerTools14(server, sendCommandToFigma);
registerTools15(server, sendCommandToFigma);
registerTools16(server, sendCommandToFigma);
registerTools17(server, sendCommandToFigma);
registerTools18(server, sendCommandToFigma);
registerTools19(server, sendCommandToFigma);
registerTools20(server, sendCommandToFigma);
registerTools21(server, sendCommandToFigma);
registerTools22(server, sendCommandToFigma);
registerTools23(server, sendCommandToFigma);
registerSetupTools(server);
registerPrompts(server);
async function main() {
  installFigmaPluginFiles();
  try {
    connectToFigma();
  } catch (error) {
    logger.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("Will try to connect when the first command is sent");
  }
  const transport = new StdioServerTransport;
  await server.connect(transport);
  logger.info("FigmaMCP server running on stdio");
  process.stdin.on("close", () => process.exit(0));
}
main().catch((error) => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
