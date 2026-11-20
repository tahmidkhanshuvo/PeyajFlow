// Browser photo model. The API accepts results only from this exact model
// revision and rule (services/api/app/inspection.py PHOTO_MODEL, PHOTO_RULE).
const MODEL = "Xenova/clip-vit-base-patch32";
const REVISION = "6b7c523703ae26e39be4b03774966f8571c7f523";
const RULE = "clip-margin-v1";
const candidates = [
  "an onion bulb with visible rot or mold",
  "an onion bulb with green shoots sprouting",
  "an onion bulb with cuts or bruises",
  "an intact onion bulb with dry clean skin",
  "a scene without a clear view of an onion bulb",
];
const results = ["rot", "sprouting", "damage", "clear", "uncertain"];
let loading;

function load() {
  loading ??= (async () => {
    const { env, pipeline, RawImage } =
      await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    const classify = await pipeline("zero-shot-image-classification", MODEL, {
      revision: REVISION,
      dtype: "q8",
      device: "wasm",
    });
    return { classify, RawImage };
  })();
  return loading;
}

self.onmessage = async ({ data }) => {
  const { id, photo } = data;
  try {
    const { classify, RawImage } = await load();
    const image = await RawImage.fromBlob(
      new Blob([photo], { type: "image/jpeg" }),
    );
    const predictions = await classify(image, candidates, {
      hypothesis_template: "A close-up photograph showing {}.",
    });
    const scores = Object.fromEntries(
      predictions.map(({ label, score }) => [
        results[candidates.indexOf(label)],
        score,
      ]),
    );
    const [top, second] = predictions;
    const result =
      top.score >= 0.58 && top.score - second.score >= 0.16
        ? results[candidates.indexOf(top.label)]
        : "uncertain";
    self.postMessage({
      id,
      result: result ?? "uncertain",
      scores,
      model: `${MODEL}@${REVISION}`,
      rule: RULE,
    });
  } catch {
    loading = undefined;
    self.postMessage({ id, error: true });
  }
};
