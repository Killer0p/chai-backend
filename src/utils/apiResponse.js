class apiResponse {
  constructor(statusCode, message, data) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success = statusCode = statusCode < 400;
  }
}

export default {apiResponse};