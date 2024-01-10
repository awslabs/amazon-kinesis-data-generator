"use strict";

exports.__esModule = true;
exports.getUserAgent = exports["default"] = exports.Platform = void 0;
var _version = require("./version");
/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var BASE_USER_AGENT = "aws-amplify/" + _version.version;
var Platform = {
  userAgent: BASE_USER_AGENT,
  isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
};
exports.Platform = Platform;
var getUserAgent = function getUserAgent() {
  return Platform.userAgent;
};

/**
 * @deprecated use named import
 */
exports.getUserAgent = getUserAgent;
var _default = Platform;
exports["default"] = _default;