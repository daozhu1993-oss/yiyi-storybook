import * as THREE from "three";
import { Diorama } from "../../src/scenes.js";

const scenes = {};
for (let i = 1; i <= 11; i++) {
  scenes[`scene-${i}`] = (ctx) => {
    const d = new Diorama(ctx);
    d.add(new THREE.Group(), {
      name: `page-${i}`,
      radius: 0.5,
      onTap: () => {
        d.ctx.sound.sparkle();
        d.burst(0xffe9a8, 25, 0.025);
      }
    });
    return d;
  };
}
scenes["end"] = (ctx) => new Diorama(ctx);
export default scenes;
