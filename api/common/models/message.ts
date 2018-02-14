import {Model} from '@mean-expert/model';

/**
 * @module Message
 * @description
 * Write a useful Message Model description.
 * Register hooks and remote methods within the
 * Model Decorator
 **/
@Model({
  hooks: {
    beforeSave: { name: 'before save', type: 'operation' }
  },
  remotes: {
    putMessage: {
      accepts: [
        {arg: 'req', type: 'object', http: {source: 'req'}},
        {arg: 'data', type: 'object', required: true, http: { source: 'body' }}
      ],
      http: {
        path: '/sigfox',
        verb: 'put'
      },
      returns: {type: 'Message', root: true}
    }
  }
})

class Message {
  // LoopBack model instance is injected in constructor
  constructor(public model: any) { }

  putMessage(req: any, data: any, next: Function): void {

    // Obtain the userId with the access_token of ctx
    const userId = req.accessToken.userId;
    // Create a new message object
    let message = new this.model;
    message = data;
    // Store the userId in the message
    message.userId = userId;
    // Get useful parameters that have to be removed from the message
    const duplicate = message.duplicate;
    const deviceNamePrefix = message.deviceNamePrefix;
    const parserId = message.parserId;
    const categoryId = message.categoryId;
    const downlinkData = message.downlinkData;


    if (!message.deviceId || !message.time || !message.seqNumber)
      next('Missing "deviceId", "time" and "seqNumber"', message);
    // Set the createdAt time
    message.createdAt = new Date(message.time * 1000);


    // Sanitize message to be saved - get rid of useless information
    delete message.duplicate;
    delete message.deviceNamePrefix;
    delete message.parserId;
    delete message.categoryId;
    delete message.downlinkData;


    // Create a new device object
    const device = new this.model.app.models.Device;
    device.id = message.deviceId;
    device.userId = userId;
    if (deviceNamePrefix)
      device.name = deviceNamePrefix + '_' + message.deviceId;
    if (parserId)
      device.parserId = parserId;
    if (categoryId)
      device.categoryId = categoryId;
    if (downlinkData)
      device.downlinkData = downlinkData;


    // Check if the device exists
    this.model.app.models.Device.findOrCreate(
      {where: {id: data.deviceId}}, // find
      device, // create
      (err: any, deviceInstance: any, created: boolean) => { // callback
        if (err) {
          console.error('Error creating device.', err);
          next(err, data);
        } else {
          if (created)
            console.log('Created new device.');
          else
            console.log('Found an existing device.');


          // If message is a duplicate
          if (duplicate) {
            this.model.findOne({
              where: {
                and: [
                  {deviceId: data.deviceId},
                  {time: data.time},
                  {seqNumber: data.seqNumber}
                ]
              }
            }, (err: any, messageInstance: any) => {
              if (err) {
                console.error(err);
                next(err, data);
              } else {
                if (messageInstance) {
                  console.log('Found the corresponding message and storing reception in it.');
                  messageInstance.reception.push(data.reception[0]);
                  this.model.upsert(
                    messageInstance,
                    (err: any, messageInstance: any) => {
                      if (err) {
                        console.error(err);
                        next(err, messageInstance);
                      } else {
                        console.log('Updated message as: ', messageInstance);
                        next(null, messageInstance);
                      }
                    });

                } else {
                  // No corresponding message found
                  const err = 'Error - No corresponding message found, did you first receive a message containing duplicate = false?';
                  console.error(err);
                  next(err, data);
                }
              }
            });
          } // if(duplicate)


          // If message contains Sigfox geoloc
          else if (message.geoloc) {
            // Build the formatted geoloc object
            const geolocSigfox = new this.model.app.models.Geoloc;
            geolocSigfox.type = message.geoloc[0].type;
            geolocSigfox.lat = message.geoloc[0].lat;
            geolocSigfox.lng = message.geoloc[0].lng;
            geolocSigfox.precision = message.geoloc[0].precision;
            // Store the formatted geoloc in the message to be saved
            message.geoloc[0] = geolocSigfox;
            // Now checking where Sigfox geoloc is in the location array so it can be updated
            let entryGeoloc_sigfox = false;
            if (!deviceInstance.location)
              deviceInstance.location = [];
            deviceInstance.location.forEach((geoloc: any, index: number) => {
              if (geoloc.type === 'sigfox') {
                deviceInstance.location[index] = geolocSigfox; // Replace Sigfox geoloc with new one
                entryGeoloc_sigfox = true;
              }
            });
            if (!entryGeoloc_sigfox)
              deviceInstance.location.push(geolocSigfox);

            // Update the device
            this.model.app.models.Device.upsert(
              deviceInstance,
              (err: any, deviceInstance: any) => {
                if (err) {
                  console.log(err);
                  next(err, data);
                } else {
                  console.log('Updated device with latest Sigfox geoloc');
                }
              });


            this.model.findOrCreate(
              {
                where: {
                  and: [
                    {deviceId: message.deviceId},
                    {time: message.time},
                    {seqNumber: message.seqNumber}
                  ]
                }
              },
              message,
              (err: any, messageInstance: any, created: boolean) => { // callback
                if (err) {
                  console.log(err);
                  next(err, data);
                } else {
                  if (created) {
                    console.log('Created new message.');

                    next(null, message);

                  } else {
                    console.log('Found an existing message.');

                    if (!messageInstance.geoloc)
                      messageInstance.geoloc = [];
                    messageInstance.geoloc.push(geolocSigfox);

                    // Update the device
                    this.model.upsert(
                      messageInstance,
                      (err: any, messageInstance: any) => {
                        if (err) {
                          console.log(err);
                          next(err, data);
                        } else {
                          console.log('Updated message with latest Sigfox geoloc.');

                          next(null, messageInstance);
                        }
                      });
                  }
                }
              });


          } // else if(data.geoloc)


          // Parse message, create message, send result to backend with downlink payload or not if the data is not null and a parser is set
          else {
            if ((deviceInstance.parserId || parserId) && message.data) {
              this.model.app.models.Parser.findById(
                deviceInstance.parserId || parserId,
                (err: any, parserInstance: any) => {
                  if (err) {
                    console.log(err);
                    next(err, data);
                  } else if (parserInstance) {
                    // Here we will decode the Sigfox payload and search for geoloc to be extracted and store in the Message
                    // @TODO: run it in another container because it can crash the app if something goes wrong...
                    const fn = Function('payload', parserInstance.function);
                    const data_parsed = fn(message.data);
                    const geoloc = new this.model.app.models.Geoloc;
                    message.data_parsed = data_parsed;

                    const deviceToUpdate = new this.model.app.models.Device;
                    deviceToUpdate.id = data.deviceId;
                    deviceToUpdate.userId = data.userId;
                    deviceToUpdate.data_parsed = data_parsed;

                    // Check if the parsed data contains a 'geoloc' key and store it in the message property to be stored
                    data_parsed.forEach((o: any) => {
                      // Look if an alert has been set for the device
                      if (deviceInstance.alerts) {
                        // Loop in all the alerts
                        deviceInstance.alerts.forEach( (alert: any, index: any) => {
                          // If the key being read is set for an alert
                          if (alert.key === o.key) {
                            // Verify conditions for the alert to be triggered
                            if (
                              (alert.value_exact && o.value === alert.value_exact) ||
                              (alert.value_min && alert.value_max && o.value >= alert.value_min && o.value <= alert.value_max) ||
                              (alert.value_less && o.value < alert.value_less) ||
                              (alert.value_more && o.value > alert.value_more)
                            ) {
                              // Trigger alert
                              this.model.app.models.Connector.findById(alert.connectorId,
                                (err: any, connector: any) => {
                                  if (err) {
                                    console.log(err);
                                    next(err, data);
                                  } else if (connector) {

                                    if (connector.type === 'office-365') {
                                      console.log('Office 365 Email alert!');
                                      if (!alert.message) alert.message = o.key.charAt(0).toUpperCase() + o.key.slice(1) + ': ' + o.value + ' ' + o.unit;

                                      // Set the connector user and pass
                                      this.model.app.models.Email.dataSource.connector.transports[0].transporter.options.auth = {
                                        user: connector.login,
                                        pass: connector.password
                                      };
                                      const title = deviceInstance.name ? deviceInstance.name : deviceInstance.id;
                                      this.model.app.models.Email.send({
                                        to: connector.recipient,
                                        from: connector.login,
                                        subject: '[Sigfox Platform] - Alert for ' + title,
                                        text: alert.message,
                                        html: 'Hey! <p>An alert has been triggered for the device: <b>' + title + '</b></p><p>' + alert.message + '</p>'
                                      }, function (err: any, mail: any) {
                                        if (err) console.error(err);
                                        else console.log('Email sent!');
                                      });

                                    } else if (connector.type === 'free-mobile') {
                                      console.log('Free Mobile SMS alert!');
                                      if (!alert.message) alert.message = o.key.charAt(0).toUpperCase() + o.key.slice(1) + ': ' + o.value + ' ' + o.unit;

                                      this.model.app.dataSources.freeMobile.sendSMS(connector.login, connector.password, alert.message).then((result: any) => {
                                      }).catch((err: any) => {
                                        console.error('Free Mobile error');
                                      });

                                    } else if (connector.type === 'twilio') {
                                      console.log('Twilio SMS alert!');
                                      // TODO: implement twilio connector

                                    } else if (connector.type === 'mqtt') {
                                      console.log('MQTT alert!');
                                      if (!alert.message) alert.message = o.key.charAt(0).toUpperCase() + o.key.slice(1) + ': ' + o.value + ' ' + o.unit;

                                      const Client = require('strong-pubsub');
                                      const Adapter = require('strong-pubsub-mqtt');
                                      const client = new Client({host: connector.host, port: connector.port}, Adapter);
                                      client.publish(connector.recipient, alert.message);
                                    }
                                    // Alert has been triggered, removing it from array
                                    deviceInstance.alerts.splice(index, 1);
                                  }
                                });
                            }
                          }
                        });
                      }
                      // Check if there is geoloc in parsed data
                      if (o.key === 'geoloc')
                        geoloc.type = o.value;
                      else if (o.key === 'lat')
                        geoloc.lat = o.value;
                      else if (o.key === 'lng')
                        geoloc.lng = o.value;
                      else if (o.key === 'precision')
                        geoloc.precision = o.value;
                    });

                    if (geoloc.type) {
                      console.warn('There is geoloc in the parsed data: storing it in message & updating device location.');
                      if (!message.geoloc)
                        message.geoloc = [];
                      message.geoloc.push(geoloc);
                      // Update the device location geoloc array
                      deviceToUpdate.location = [geoloc];
                    }

                    // Update the device with parsed data objects keys & geoloc if present
                    this.model.app.models.Device.upsert(
                      deviceToUpdate,
                      (err: any, deviceInstance: any) => {
                        if (err) {
                          console.log(err);
                          next(err, data);
                        } else {
                          console.log('Updated device as: ', deviceInstance);
                        }
                      });

                    this.createMessageAndSendResponse(message, next, this.model);
                  }
                });
            } // if (deviceInstance.parserId || parserId)

            else {
              this.createMessageAndSendResponse(message, next, this.model);
            }
          }
        }
      });
  }


  private createMessageAndSendResponse(message: any, next: Function, messageModel: any) {
    // Ack from BIDIR callback
    if (message.ack) {
      let result;
      this.model.app.models.Device.findOne({where: {id: message.deviceId}}, function (err: any, device: any) {
        if (device.downlinkData) {
          message.downlinkData = device.downlinkData;
          result = {
            [message.deviceId]: {
              downlinkData: device.downlinkData
            }
          };
        } else {
          result = {
            [message.deviceId]: {
              noData: true
            }
          };
        }
        // Creating new message with its downlink data
        messageModel.create(
          message,
          (err: any, messageInstance: any) => {
            if (err) {
              console.error(err);
              next(err, messageInstance);
            } else {
              console.log('Created message as: ', messageInstance);
            }
          });
        // ack is true
        next(null, result);
      });
    } else {
      // ack is false
      // Creating new message with no downlink data
      messageModel.create(
        message,
        (err: any, messageInstance: any) => {
          if (err) {
            console.error(err);
            next(err, messageInstance);
          } else {
            console.log('Created message as: ', messageInstance);
            next(null, messageInstance);
          }
        });
    }
  }


  // Example Operation Hook
  beforeSave(ctx: any, next: Function): void {
    console.log('Message: Before Save');
    next();
  }

  // Example Remote Method
  myRemote(next: Function): void {
    this.model.find(next);
  }
}

module.exports = Message;
