import {Model} from "@mean-expert/model";

/**
 * @module Widget
 * @description
 * Write a useful Widget Model description.
 * Register hooks and remote methods within the
 * Model Decorator
 **/
@Model({
  hooks: {
    beforeSave: { name: "before save", type: "operation" },
  },
  remotes: { },
})

class Widget {
  // LoopBack model instance is injected in constructor
  constructor(public model: any) {}

  // Example Operation Hook
  public beforeSave(ctx: any, next: Function): void {
    if (ctx.instance) ctx.instance.createdAt = new Date();
    console.log("Widget: Before Save");
    next();
  }
}

module.exports = Widget;
