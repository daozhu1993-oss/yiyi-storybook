import * as THREE from "three";
import { Diorama } from "../../src/scenes.js";

export default {
  "scene-1": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-1",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-2": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-2",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-3": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-3",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-4": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-4",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-5": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-5",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-6": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-6",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-7": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-7",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-8": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-8",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-9": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-9",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-10": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-10",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-11": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-11",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "scene-12": (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: "page-12",
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  },
  "end": (ctx) => {
    const d = new Diorama(ctx);
    return d;
  }
};
