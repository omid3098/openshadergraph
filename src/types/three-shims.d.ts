declare module "three" {
  const ThreeNamespace: any;
  export = ThreeNamespace;
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export const OrbitControls: any;
}

declare module "three/examples/jsm/environments/RoomEnvironment.js" {
  export const RoomEnvironment: any;
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    loadAsync(src: string): Promise<any>;
  }
}

