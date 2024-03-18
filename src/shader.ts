import { Drawable } from "./app.ts";


/** 
 * Create a simple rendering shader 
 * 
 * @param code should have two entry points: vertexMain and fragmentMain
 *   The uniform buffer will be passed a single u32 containging the frame number
 * @param canvasContext the shader will render to the provided output texture 
 * 
 * @returns an object containing a draw() function to trigger gpu rendering.
*/
export async function simpleRenderShader(
  device: GPUDevice,
  canvasContext: GPUCanvasContext,
  code: string
): Promise<Drawable> {
  let frameNumber = 0;

  const shaderModule = device.createShaderModule({ code });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const uniformBufferSize = 1 * 4; // .frame
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: "triangle-strip",
    },
  });

  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const uniformData = new ArrayBuffer(uniformBufferSize);


  function draw(): void {
    const view = new DataView(uniformData);
    view.setUint32(0, frameNumber++, true);

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const commandEncoder = device.createCommandEncoder();
    const textureView = canvasContext.getCurrentTexture().createView();

    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(4, 1);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
  }
  return { draw, stopped: true };
}
