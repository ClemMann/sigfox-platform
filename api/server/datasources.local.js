'use strict';
const mongodbURI = process.env.MONGODB_URI;

if(mongodbURI) {
  console.log('Data sources: Using MongoDB config', mongodbURI);
  module.exports = {
    "mongodb": {
      "url": mongodbURI,
      "name": "mongodb",
      "connector": "mongodb"
    }
  }
}
