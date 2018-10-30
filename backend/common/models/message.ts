import {Model} from "@mean-expert/model";
import {computeCtr, decryptPayload, encryptPayload} from "./utils";
import {PrimusClientFn} from "../../server/PrimusClientFn";

/**
 * @module Message
 * @description
 * Write a useful Message Model description.
 * Register hooks and remote methods within the
 * Model Decorator
 **/
@Model({
  hooks: {
    beforeDelete: {name: "before delete", type: "operation"},
    afterDelete: {name: "after delete", type: "operation"},
    afterSave: {name: "after save", type: "operation"},
  },
  remotes: {
    postSigfox: {
      accepts: [
        {arg: "req", type: "object", http: {source: "req"}},
        {arg: "data", type: "object", required: true, http: {source: "body"}},
      ],
      http: {
        path: "/sigfox",
        verb: "post",
      },
      returns: {type: "Message", root: true},
    },
    postSigfoxAcknowledge: {
      accepts: [
        {arg: "req", type: "object", http: {source: "req"}},
        {arg: "data", type: "object", required: true, http: {source: "body"}},
      ],
      http: {
        path: "/sigfox/acknowledge",
        verb: "post",
      },
      returns: {type: "Message", root: true},
    },
    postSigfoxStatus: {
      accepts: [
        {arg: "req", type: "object", http: {source: "req"}},
        {arg: "data", type: "object", required: true, http: {source: "body"}},
      ],
      http: {
        path: "/sigfox/status",
        verb: "post",
      },
      returns: {type: "Message", root: true},
    },
  },
})

class Message {

  private primusClient: any;

  // LoopBack model instance is injected in constructor
  constructor(public model: any) {
    this.primusClient = PrimusClientFn.newClient();
  }

  public postSigfox(req: any, data: any, next: Function): void {
    // Models
    const Message = this.model;
    const Device = this.model.app.models.Device;
    const Parser = this.model.app.models.Parser;

    if (typeof data.deviceId === "undefined"
      || typeof data.time === "undefined"
      || typeof data.seqNumber === "undefined") {
      return next('Missing "deviceId", "time" and "seqNumber"', data);
    }

    // Obtain the userId with the access token of ctx
    const userId = req.accessToken.userId;

    // Auto set uppercase for deviceId
    data.deviceId = data.deviceId.toUpperCase();

    // Create a new message object
    let message = new Message;
    message = data;

    // Set the message id
    message.id = message.deviceId + message.time + message.seqNumber;

    // Set the createdAt time
    message.createdAt = new Date(message.time * 1000);

    // Create a new device object
    const device = new Message.app.models.Device;
    device.id = message.deviceId;
    device.userId = userId;
    if (message.deviceNamePrefix) {
      device.name = message.deviceNamePrefix + "_" + message.deviceId;
    }
    if (message.parserId) {
      device.parserId = message.parserId;
    }
    if (message.categoryId) {
      device.categoryId = message.categoryId;
    }
    if (message.data_downlink) {
      device.data_downlink = message.data_downlink;
    }

    // Store the message duplicate flag and parserId
    const duplicate = message.duplicate;
    const parserId = message.parserId;

    // Sanitize message to be saved - get rid of useless information
    delete message.duplicate;
    delete message.deviceNamePrefix;
    delete message.parserId;
    delete message.categoryId;
    delete message.data_downlink;

    // Check if the device exists or create it
    Device.findOrCreate(
      {where: {id: device.id}, include: ["Alerts", "Parser"]}, // find
      device, // create
      (err: any, deviceInstance: any, created: boolean) => { // callback
        if (err) {
          console.error("Error creating device.", err);
          return next(err, data);
        } else {
          const deviceInstanceFunction = deviceInstance;
          deviceInstance = deviceInstance.toJSON();
          // Store the userId in the message
          message.userId = deviceInstance.userId;
          if (created) {
            console.log("Created new device: " + message.deviceId);
          } else {
            // console.log('Found an existing device.');
            if (deviceInstance.locked === false && deviceInstance.userId.toString() !== userId.toString()) {
              // Store the userId in the message
              message.userId = userId;

              deviceInstanceFunction.updateAttribute('userId', userId, (err: any, deviceUpdated: any) => {
                if (err) console.error(err);
                else console.log("Updated device userId as: ", deviceUpdated);
              });
            }
          }

          if (deviceInstance.pek) {
            const ctr = computeCtr(deviceInstance.id, true, message.seqNumber.toString());
            message.data = decryptPayload(message.data, deviceInstance.pek, ctr);
          }

          // If message is a duplicate
          if (duplicate) {
            Message.findById(
              message.id,
              (err: any, messageInstance: any) => {
                if (err) {
                  console.error(err);
                  next(err, data);
                } else if (messageInstance) {
                  // console.log('Found the corresponding message and storing reception in it.');
                  if (!messageInstance.reception) messageInstance.reception = [];
                  const reception = messageInstance.reception.push(data.reception[0]);
                  messageInstance.updateAttribute(
                    'reception',
                    [reception],
                    (err: any, messageInstance: any) => {
                      if (err) {
                        console.error(err);
                        next(err, messageInstance);
                      } else {
                        // console.log('Updated message as: ', messageInstance);
                        next(null, messageInstance);
                      }
                    });
                } else {
                  // No corresponding message found
                  const err = "Error - No corresponding message found, did you first receive a message containing duplicate = false?";
                  console.error(err);
                  next(null, 'Trashing message');
                }
              });
          } else {
            if ((deviceInstance.Parser || parserId) && message.data) {
              // If the device is not linked to a parser
              if (!deviceInstance.Parser && parserId) {
                // Save a parser in the device and parse the message
                console.log('Associating parser to device.');
                deviceInstanceFunction.updateAttribute('parserId', parserId, (err: any, deviceUpdated: any) => {
                  if (err) {
                    console.error(err);
                    return next(err, data);
                  } else {
                    console.log("Updated device parser as: ", deviceUpdated);
                    Parser.findById(parserId, (err: any, parserInstance: any) => {
                      if (err) {
                        console.error(err);
                        return next(err, data);
                      } else if (parserInstance && parserInstance.function) {
                        deviceUpdated = deviceUpdated.toJSON();
                        deviceUpdated.Parser = parserInstance.toJSON();

                        // Decode the payload
                        Parser.parsePayload(
                          deviceUpdated.Parser.function,
                          message.data,
                          req,
                          (err: any, data_parsed: any) => {
                            if (err) {
                              // console.error(err);
                            } else {
                              message.data_parsed = data_parsed;
                              for (let p of message.data_parsed) {
                                if (p.key === "time" && p.type === "date") {
                                  if (p.value instanceof Date) {
                                    message.createdAt = p.value;
                                  }
                                  break;
                                }
                              }
                            }
                            // Create message
                            this.createMessageAndSendResponse(deviceUpdated, message, req, next);
                          });
                      } else {
                        // Create message with no parsed data because of wrong parser id
                        console.error("The parserId of this device (" + deviceInstance.id + ") is linked to no existing parsers!");
                        this.createMessageAndSendResponse(deviceInstance, message, req, next);
                      }
                    });
                  }
                });
              } else {
                // console.log('Found parser!');

                // Decode the payload
                Parser.parsePayload(
                  deviceInstance.Parser.function,
                  message.data,
                  req,
                  (err: any, data_parsed: any) => {
                    if (err) {
                      console.error(err);
                    } else {
                      message.data_parsed = data_parsed;
                      message.data_parsed.forEach((p: any) => {
                        if (p.key === "time" && p.type === "date") {
                          if (p.value instanceof Date) {
                            message.createdAt = p.value;
                          }
                          return;
                        }
                      });
                    }
                    // Create message
                    this.createMessageAndSendResponse(deviceInstance, message, req, next);
                  });
              }
            } else { // No parser & no data
              // Create message
              this.createMessageAndSendResponse(deviceInstance, message, req, next);
            }
          }
        }
      });
  }

  public createMessageAndSendResponse(device: any, message: any, req: any, next: Function) {
    // Models
    const Message = this.model;
    const Alert = this.model.app.models.Alert;
    const Geoloc = this.model.app.models.Geoloc;

    // Ack from BIDIR callback
    if (message.ack) {
      let result;
      if (device.data_downlink) {
        if (device.pek) {
          const ctr = computeCtr(device.id, false, message.seqNumber.toString());
          message.data_downlink = encryptPayload(device.data_downlink, device.pek, ctr);
          result = {
            [message.deviceId]: {
              downlinkData: message.data_downlink,
            },
          };
        } else {
          message.data_downlink = device.data_downlink;
          result = {
            [message.deviceId]: {
              downlinkData: device.data_downlink,
            },
          };
        }
      } else {
        result = {
          [message.deviceId]: {
            noData: true,
          },
        };
      }
      // Creating new message with its downlink data
      Message.create(
        message, // create
        (err: any, messageInstance: any) => { // callback
          if (err) {
            console.error(err);
            // return next(err, messageInstance);
          } else if (messageInstance) {
            // console.log('Created message as: ', messageInstance);
            if (message.data_parsed) {
              // Check if there is Geoloc in payload and create Geoloc object
              Geoloc.createFromParsedPayload(
                messageInstance,
                (err: any, res: any) => {
                  if (err) {
                    console.error(err);
                  } else {
                    // console.log(res);
                  }
                });
              // Trigger alerts (if any)
              Alert.triggerByDevice(
                message.data_parsed,
                device,
                req,
                (err: any, res: any) => {
                  if (err) {
                    // console.error(err);
                  } else {
                    // console.log(res);
                  }
                });
            }
          } else {
            console.error("This message for device (" + message.deviceId + ") has already been created.");
          }
        });
      // ack is true
      next(null, result);
    } else {
      // ack is false
      // Creating new message with no downlink data
      Message.create(
        message, // create
        (err: any, messageInstance: any) => { // callback
          if (err) {
            console.error(err);
            next(err, messageInstance);
          } else if (messageInstance) {
            // console.log('Created message as: ', messageInstance);
            if (message.data_parsed) {
              // Check if there is Geoloc in payload and create Geoloc object
              Geoloc.createFromParsedPayload(
                messageInstance,
                (err: any, res: any) => {
                  if (err) {
                    console.error(err);
                    // next(err, null);
                  } else {
                    // console.log(res);
                  }
                });
              // Trigger alerts (if any)
              Alert.triggerByDevice(
                message.data_parsed,
                device,
                req,
                (err: any, res: any) => {
                  if (err) {
                    // console.error(err);
                  } else {
                    // console.log(res);
                  }
                });
            }
            next(null, messageInstance);
          } else {
            next(null, "This message for device (" + message.deviceId + ") has already been created.");
          }
        });
    }
  }

  public updateDevice(deviceId: string, createdAt: Date) {
    // Model
    const Device = this.model.app.models.Device;
    Device.findOne({
        where: {id: deviceId},
        limit: 1,
        include: [{
          relation: "Messages",
          scope: {
            order: "createdAt DESC",
            limit: 100,
          },
        }],
      },
      (err: any, deviceInstance: any) => {
        if (err) {
          console.error(err);
        } else if (deviceInstance) {
          // Update the device success rate
          if (deviceInstance.Messages && deviceInstance.Messages.length > 0) {
            const device = deviceInstance.toJSON();
            let attendedNbMessages: number;
            attendedNbMessages = device.Messages[0].seqNumber - device.Messages[device.Messages.length - 1].seqNumber + 1;
            if (device.Messages[device.Messages.length - 1].seqNumber > device.Messages[0].seqNumber) {
              attendedNbMessages += 4095;
            }
            device.successRate = (((device.Messages.length / attendedNbMessages) * 100)).toFixed(2);
            deviceInstance.updateAttribute('successRate', device.successRate);
          }
          // Update the date when the device was last seen
          deviceInstance.updateAttribute('messagedAt', createdAt);
        } else {
          console.error("Could not update the success rate of an unknown device");
        }
      });
  }

  public linkMessageToOrganization(message: any, cb?: (device: any) => void) {
    // Model
    const Device = this.model.app.models.Device;

    Device.findOne({where: {id: message.deviceId}, include: "Organizations"}, (err: any, deviceInstance: any) => {
      if (deviceInstance) {
        if (deviceInstance.toJSON().Organizations.length > 0) {
          const db = Device.dataSource.connector.db;
          const OrganizationMessage = db.collection('OrganizationMessage');
          OrganizationMessage.insertMany(deviceInstance.toJSON().Organizations.map((x: any) => ({
            messageId: message.id,
            deviceId: message.deviceId,
            createdAt: message.createdAt,
            organizationId: x.id
          })), (err: any, result: any) => {
            if (err) console.error(err);
          })
        }
        cb(deviceInstance);
      }
    });
  }

  public postSigfoxAcknowledge(req: any, data: any, next: Function): void {
    // Models
    const Message = this.model;

    if (typeof data.deviceId === "undefined"
      || typeof data.time === "undefined"
      || typeof data.downlinkAck === "undefined") {
      return next('Missing "deviceId", "time" and "downlinkAck"', data);
    }

    // Obtain the userId with the access token of ctx
    const userId = req.accessToken.userId;

    // Find the message containing the ack request
    Message.findOne({
      where: {
        and: [
          {deviceId: data.deviceId},
          {time: data.time},
          {ack: true},
        ]
      },
    }, (err: any, messageInstance: any) => {
      if (err) {
        console.error(err);
        next(err, data);
      } else {
        if (messageInstance) {
          console.log("Found the corresponding message and downlinkAck in it.");
          messageInstance.downlinkAck = data.downlinkAck;
          Message.upsert(
            messageInstance,
            (err: any, messageInstance: any) => {
              if (err) {
                console.error(err);
                next(err, messageInstance);
              } else {
                console.log("Updated message as: ", messageInstance);
                next(null, messageInstance);
              }
            });

        } else {
          // No corresponding message found
          const err = "Error - No corresponding message found, did you first receive a message containing ack = true?";
          console.error(err);
          next(err, data);
        }
      }
    });
  }

  public postSigfoxStatus(req: any, data: any, next: Function): void {
    // Models
    const Message = this.model;

    if (typeof data.deviceId === "undefined"
      || typeof data.time === "undefined"
      || typeof data.seqNumber === "undefined") {
      return next('Missing "deviceId", "time" and "seqNumber"', data);
    }

    // Obtain the userId with the access token of ctx
    const userId = req.accessToken.userId;

    // Auto set uppercase for deviceId
    data.deviceId = data.deviceId.toUpperCase();

    // Create a new message object
    const message = new Message;

    message.userId = userId;
    message.deviceId = data.deviceId;
    message.time = data.time;
    message.seqNumber = data.seqNumber;
    message.deviceAck = true;
    message.createdAt = new Date(data.time * 1000);

    // Find the message containing the ack request
    Message.create(message, (err: any, messageInstance: any) => {
      if (err) {
        console.error(err);
        next(err, data);
      } else if (messageInstance) {
        console.log("Created status message as: ", messageInstance);
        next(null, messageInstance);
      }
    });
  }

  // Before delete message, remove geoloc & category organizaton links
  public beforeDelete(ctx: any, next: Function): void {
    // Models
    const Message = this.model;
    const Geoloc = this.model.app.models.Geoloc;

    // Destroy geolocs corresponding to the messageId
    if (ctx.where.id) {
      Geoloc.destroyAll({messageId: ctx.where.id}, (error: any, result: any) => {
        console.log("Removed geoloc for messageId: " + ctx.where.id);
      });
    }
    // Destroy organization link
    Message.findOne({where: {id: ctx.where.id}, include: "Organizations"}, (err: any, message: any) => {
      // console.log(category);
      if (!err) {
        if (message && message.Organizations) {
          message.toJSON().Organizations.forEach((orga: any) => {
            message.Organizations.remove(orga.id, (err: any, result: any) => {
              if (!err) {
                console.log("Unlinked device from organization (" + orga.name + ")");
              }
            });
          });
        }
        next(null, "Unlinked device from organization");
      } else {
        next(err);
      }
    });
  }

  public afterDelete(ctx: any, next: Function): void {
    let msg = ctx.instance;
    if (msg) {
      // if the message is delete via a cascade, no instance is provided
      const payload = {
        event: "message",
        content: msg,
        action: "DELETE"
      };
      this.primusClient.write(payload);
    }
    next();
  }

  public afterSave(ctx: any, next: Function): void {
    // TODO: merge these 2 functions
    // Calculate success rate and update device
    this.updateDevice(ctx.instance.deviceId, ctx.instance.createdAt);
    this.linkMessageToOrganization(ctx.instance, (device => {
      // Pub-sub
      let msg = ctx.instance;
      const payload = {
        event: "message",
        device: device,
        content: msg,
        action: ctx.isNewInstance ? "CREATE" : "UPDATE"
      };
      this.primusClient.write(payload);
    }));
    next();
  }
}

module.exports = Message;
