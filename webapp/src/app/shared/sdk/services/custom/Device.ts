/* tslint:disable */
import { Injectable, Inject, Optional } from '@angular/core';
import { Http, Response } from '@angular/http';
import { SDKModels } from './SDKModels';
import { BaseLoopBackApi } from '../core/base.service';
import { LoopBackConfig } from '../../lb.config';
import { LoopBackAuth } from '../core/auth.service';
import { LoopBackFilter,  } from '../../models/BaseModels';
import { JSONSearchParams } from '../core/search.params';
import { ErrorHandler } from '../core/error.service';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Rx';
import { Device } from '../../models/Device';
import { SocketConnection } from '../../sockets/socket.connections';


/**
 * Api services for the `Device` model.
 */
@Injectable()
export class DeviceApi extends BaseLoopBackApi {

  constructor(
    @Inject(Http) protected http: Http,
    @Inject(SocketConnection) protected connection: SocketConnection,
    @Inject(SDKModels) protected models: SDKModels,
    @Inject(LoopBackAuth) protected auth: LoopBackAuth,
    @Inject(JSONSearchParams) protected searchParams: JSONSearchParams,
    @Optional() @Inject(ErrorHandler) protected errorHandler: ErrorHandler
  ) {
    super(http,  connection,  models, auth, searchParams, errorHandler);
  }

  /**
   * <em>
         * (The remote method definition does not provide any description.)
         * </em>
   *
   * @param {string} id 
   *
   * @param {string} type 
   *
   * @param {object} req 
   *
   * @param {object} res 
   *
   * @returns {object} An empty reference that will be
   *   populated with the actual data once the response is returned
   *   from the server.
   *
   * <em>
   * (The remote method definition does not provide any description.
   * This usually means the response is a `Device` object.)
   * </em>
   */
  public download(id: any, type: any, req: any = {}, res: any = {}, customHeaders?: Function): Observable<any> {
    let _method: string = "GET";
    let _url: string = LoopBackConfig.getPath() + "/" + LoopBackConfig.getApiVersion() +
    "/Devices/download/:id/:type";
    let _routeParams: any = {
      id: id,
      type: type
    };
    let _postBody: any = {};
    let _urlParams: any = {};
    let result = this.request(_method, _url, _routeParams, _urlParams, _postBody, null, customHeaders);
    return result;
  }

  /**
   * <em>
         * (The remote method definition does not provide any description.)
         * </em>
   *
   * @param {string} deviceId Device Id
   *
   * @param {string} dateBegin The starting date-time
   *
   * @param {string} dateEnd The ending date-time
   *
   * @param {object} req 
   *
   * @returns {object} An empty reference that will be
   *   populated with the actual data once the response is returned
   *   from the server.
   *
   * Data properties:
   *
   *  - `result` – `{any}` - 
   */
  public timeSeries(deviceId: any, dateBegin: any = {}, dateEnd: any = {}, req: any = {}, customHeaders?: Function): Observable<any> {
    let _method: string = "GET";
    let _url: string = LoopBackConfig.getPath() + "/" + LoopBackConfig.getApiVersion() +
    "/Devices/time-series";
    let _routeParams: any = {};
    let _postBody: any = {};
    let _urlParams: any = {};
    if (typeof deviceId !== 'undefined' && deviceId !== null) _urlParams.deviceId = deviceId;
    if (typeof dateBegin !== 'undefined' && dateBegin !== null) _urlParams.dateBegin = dateBegin;
    if (typeof dateEnd !== 'undefined' && dateEnd !== null) _urlParams.dateEnd = dateEnd;
    let result = this.request(_method, _url, _routeParams, _urlParams, _postBody, null, customHeaders);
    return result;
  }

  /**
   * <em>
         * (The remote method definition does not provide any description.)
         * </em>
   *
   * @param {string} id Device Id
   *
   * @param {number} limit Limit retrieved messages (max 100)
   *
   * @param {number} before Before
   *
   * @param {object} req 
   *
   * @returns {object[]} An empty reference that will be
   *   populated with the actual data once the response is returned
   *   from the server.
   *
   * <em>
   * (The remote method definition does not provide any description.
   * This usually means the response is a `Device` object.)
   * </em>
   */
  public getMessagesFromSigfoxBackend(id: any, limit: any = {}, before: any = {}, req: any = {}, customHeaders?: Function): Observable<any> {
    let _method: string = "GET";
    let _url: string = LoopBackConfig.getPath() + "/" + LoopBackConfig.getApiVersion() +
    "/Devices/:id/messages-from-sigfox-backend";
    let _routeParams: any = {
      id: id
    };
    let _postBody: any = {};
    let _urlParams: any = {};
    if (typeof limit !== 'undefined' && limit !== null) _urlParams.limit = limit;
    if (typeof before !== 'undefined' && before !== null) _urlParams.before = before;
    let result = this.request(_method, _url, _routeParams, _urlParams, _postBody, null, customHeaders);
    return result;
  }

  /**
   * The name of the model represented by this $resource,
   * i.e. `Device`.
   */
  public getModelName() {
    return "Device";
  }
}
