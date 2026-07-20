import assert from "node:assert/strict";
import { inferForecastLesson, inferForecastSubject } from "../forecastIntent";

assert.equal(inferForecastSubject("guessing electrical prshnyk denna 2026 al enna puluwm", "SFT"), "ET");
assert.equal(inferForecastLesson("guessing electrical prshnyk denna 2026 al enna puluwm", "ET"), "විදුලි තාක්ෂණවේදය / Electrical Technology");
assert.equal(inferForecastSubject("2026 ICT database question ekak denna", "SFT"), "ICT");
assert.equal(inferForecastSubject("2026 SFT විද්‍යුතය ප්‍රශ්නයක්", "ET"), "SFT");
assert.equal(inferForecastSubject("2026 civil structured question", "SFT"), "ET");
assert.equal(inferForecastLesson("2026 electrical machines transformer question", "ET"), "විදුලි යන්ත්‍ර / Electrical Machines");
console.log("forecast intent tests passed");
