// export interface CanvasRenderer extends Renderer {
//     setCanvas: (value: HTMLCanvasElement) => void
// }

// export const createCanvasRenderer = (): CanvasRenderer => {
//     let canvas: unknown = null

//     const render: RenderFunction = (scene, context) => {
//         return Promise.resolve()
//     }

//     return {
//         setCanvas: (value: HTMLCanvasElement) => {
//             canvas = value
//         },
//         render,
//     }
// }
