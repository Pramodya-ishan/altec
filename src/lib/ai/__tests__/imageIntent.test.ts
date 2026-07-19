import assert from 'node:assert/strict';
import { isClientImageGenerationIntent, isClientVisualExplanationIntent } from '../imageIntent';

assert.equal(isClientImageGenerationIntent('create an image explaining honey sugar composition in Sinhala'), true);
assert.equal(isClientImageGenerationIntent('මී පැණි සීනි සංයුතිය රූපයක් ලෙස හදන්න'), true);
assert.equal(isClientImageGenerationIntent('draw a diagram of the water cycle'), true);
assert.equal(isClientImageGenerationIntent('මේක රූපයක් සමඟ පැහැදිලි කරන්න'), true);
assert.equal(isClientImageGenerationIntent('meka image ekkin explain krnn'), true);
assert.equal(isClientImageGenerationIntent('explain this with a diagram'), true);
assert.equal(isClientVisualExplanationIntent('මේක රූපයක් සමග පැහැදිලි කරන්න'), true);
assert.equal(isClientImageGenerationIntent('explain this image', true), false);
assert.equal(isClientImageGenerationIntent('explain fructose'), false);
console.log('Client image intent tests passed');
