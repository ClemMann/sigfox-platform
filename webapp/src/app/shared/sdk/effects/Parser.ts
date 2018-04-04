/* tslint:disable */
import { map, catchError, mergeMap } from 'rxjs/operators'
import { of } from 'rxjs/observable/of';
import { concat } from 'rxjs/observable/concat';
import { Injectable, Inject } from '@angular/core';
import { Effect, Actions } from '@ngrx/effects';

import { LoopbackAction } from '../models/BaseModels';
import { BaseLoopbackEffects } from './base';
import { resolver } from './resolver';

import * as actions from '../actions';
import { ParserActionTypes, ParserActions } from '../actions/Parser';
import { LoopbackErrorActions } from '../actions/error';
import { ParserApi } from '../services/index';

@Injectable()
export class ParserEffects extends BaseLoopbackEffects {
  @Effect()
  public parseAllMessages$ = this.actions$
    .ofType(ParserActionTypes.PARSE_ALL_MESSAGES).pipe(
      mergeMap((action: LoopbackAction) =>
        this.parser.parseAllMessages(action.payload.id, action.payload.req).pipe(
          map((response: any) => new ParserActions.parseAllMessagesSuccess(action.payload.id, response, action.meta)),
          catchError((error: any) => concat(
            of(new ParserActions.parseAllMessagesFail(error, action.meta)),
            of(new LoopbackErrorActions.error(error, action.meta))
          ))
        )
      )
    );

  @Effect()
  public parseAllDevices$ = this.actions$
    .ofType(ParserActionTypes.PARSE_ALL_DEVICES).pipe(
      mergeMap((action: LoopbackAction) =>
        this.parser.parseAllDevices(action.payload.id, action.payload.req).pipe(
          map((response: any) => new ParserActions.parseAllDevicesSuccess(action.payload.id, response, action.meta)),
          catchError((error: any) => concat(
            of(new ParserActions.parseAllDevicesFail(error, action.meta)),
            of(new LoopbackErrorActions.error(error, action.meta))
          ))
        )
      )
    );

    /**
   * @author João Ribeiro <@JonnyBGod> <github:JonnyBGod>
   * @description
   * Decorate base effects metadata
   */
  @Effect() public create$;
  @Effect() public createMany$;
  @Effect() public findById$;
  @Effect() public find$;
  @Effect() public findOne$;
  @Effect() public updateAll$;
  @Effect() public deleteById$;
  @Effect() public updateAttributes$;
  @Effect() public upsert$;
  @Effect() public upsertWithWhere$;
  @Effect() public replaceOrCreate$;
  @Effect() public replaceById$;
  @Effect() public patchOrCreate$;
  @Effect() public patchAttributes$;

  constructor(
    @Inject(Actions) public actions$: Actions,
    @Inject(ParserApi) public parser: ParserApi
  ) {
    super(actions$, parser, 'Parser', ParserActionTypes, ParserActions);
  }
}
