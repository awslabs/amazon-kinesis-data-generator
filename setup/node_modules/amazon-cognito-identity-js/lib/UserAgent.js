"use strict";

exports.__esModule = true;
exports.getAmplifyUserAgent = exports["default"] = exports.appendToCognitoUserAgent = exports.addFrameworkToCognitoUserAgent = exports.addAuthCategoryToCognitoUserAgent = void 0;
var _Platform = require("./Platform");
var _constants = require("./Platform/constants");
// constructor
function UserAgent() {}
// public
UserAgent.prototype.userAgent = (0, _Platform.getUserAgent)();
var appendToCognitoUserAgent = function appendToCognitoUserAgent(content) {
  if (!content) {
    return;
  }
  if (UserAgent.prototype.userAgent && !UserAgent.prototype.userAgent.includes(content)) {
    UserAgent.prototype.userAgent = UserAgent.prototype.userAgent.concat(' ', content);
  }
  if (!UserAgent.prototype.userAgent || UserAgent.prototype.userAgent === '') {
    UserAgent.prototype.userAgent = content;
  }
};
exports.appendToCognitoUserAgent = appendToCognitoUserAgent;
var addAuthCategoryToCognitoUserAgent = function addAuthCategoryToCognitoUserAgent() {
  UserAgent.category = _constants.AUTH_CATEGORY;
};
exports.addAuthCategoryToCognitoUserAgent = addAuthCategoryToCognitoUserAgent;
var addFrameworkToCognitoUserAgent = function addFrameworkToCognitoUserAgent(framework) {
  UserAgent.framework = framework;
};
exports.addFrameworkToCognitoUserAgent = addFrameworkToCognitoUserAgent;
var getAmplifyUserAgent = function getAmplifyUserAgent(action) {
  var uaCategoryAction = UserAgent.category ? " " + UserAgent.category : '';
  var uaFramework = UserAgent.framework ? " framework/" + UserAgent.framework : '';
  var userAgent = "" + UserAgent.prototype.userAgent + uaCategoryAction + uaFramework;
  return userAgent;
};

// class for defining the amzn user-agent
exports.getAmplifyUserAgent = getAmplifyUserAgent;
var _default = UserAgent;
exports["default"] = _default;