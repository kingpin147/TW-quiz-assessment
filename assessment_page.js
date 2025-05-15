import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { generateAssessmentPDF } from 'backend/pdfGenerator';

let answers = [];
let chartDataUrl = "";
let chartReceived = false;
let fixerPct, reactorPct, impactorPct;

$w.onReady(async () => {
    $w("#score").hide();

    // 📩 Listen for chart image from iframe once
    $w("#html1").onMessage(async (event) => {
        if (!chartReceived && event.data?.chartImage) {
            chartReceived = true;
            chartDataUrl = event.data.chartImage;
            await generatePDF();
            $w("#THANK").text = "Thank You for attempting this assessment.";
        }
    });

    // 📚 Load and sort quiz questions
    const results = await wixData.query("Assesment").find();
    const sortedItems = results.items
        .filter(item => item.text && !isNaN(parseInt(item.text)))
        .sort((a, b) => parseInt(a.text) - parseInt(b.text));

    // 🎯 Assign each question to State1–State25
    sortedItems.forEach((item, i) => {
        const index = i + 1;
        $w(`#questionText${index}`).text = item.assessmentQuestion;
        $w(`#radioGroup${index}`).options = [
            { label: item.option1, value: "A" },
            { label: item.option2, value: "B" },
            { label: item.option3, value: "C" },
        ];
        $w(`#radioGroup${index}`).onChange(e => {
            const existing = answers.find(a => a.index === i);
            if (existing) {
                existing.value = e.target.value;
            } else {
                answers.push({ index: i, value: e.target.value });
            }
            e.target.disable();
        });
    });

    updateButtons(1);
});

// ⏭ NEXT / SUBMIT
$w("#next").onClick(() => {
    const curr = +$w("#multiStateBox").currentState.id.replace("State", "");

    if (curr < 25) {
        const next = curr + 1;
        $w("#multiStateBox").changeState(`State${next}`);
        updateButtons(next);
        return;
    }

    // ✅ Validate all answered
    if (answers.length < 25) {
        $w("#score").text = "Please answer all questions before submitting.";
        $w("#score").show();
        return;
    }
    $w("#score").hide();

    // 🔢 Calculate scores
    const counts = answers.reduce((acc, a) => {
        acc[a.value]++;
        return acc;
    }, { A: 0, B: 0, C: 0 });

    const toPct = n => Math.round((n / 25) * 100);
    fixerPct = toPct(counts.A);
    reactorPct = toPct(counts.B);
    impactorPct = toPct(counts.C);

    // 📤 Send chart data to iframe
    $w("#html1").postMessage({ fixerPct, reactorPct, impactorPct });

    // 💬 Optional visual score
    $w("#score").text = `Fixer: ${fixerPct}% | Reactor: ${reactorPct}% | Impactor: ${impactorPct}%`;
    $w("#score").show();

    // ⏳ Wait screen
    $w("#multiStateBox").changeState("State26");
    updateButtons(26);
});

// 🔙 BACK
$w("#back").onClick(() => {
    const curr = +$w("#multiStateBox").currentState.id.replace("State", "");
    if (curr > 1 && curr <= 25) {
        const prev = curr - 1;
        $w("#multiStateBox").changeState(`State${prev}`);
        updateButtons(prev);
    }
});

// 🎯 Control buttons
function updateButtons(stateIndex) {
    if (stateIndex === 1) {
        $w("#back").hide();
        $w("#next").label = "Next";
        $w("#next").show();
    } else if (stateIndex === 25) {
        $w("#back").show();
        $w("#next").label = "Submit";
        $w("#next").show();
    } else if (stateIndex === 26) {
        $w("#back").hide();
        $w("#next").hide();
    } else {
        $w("#back").show();
        $w("#next").label = "Next";
        $w("#next").show();
    }
}

// 📄 Generate PDF once chart is ready
async function generatePDF() {
    const today = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });

    try {
        const { downloadUrl } = await generateAssessmentPDF(answers, chartDataUrl, today, {
            fixerPct,
            reactorPct,
            impactorPct
        });
        wixLocation.to(downloadUrl);
    } catch (err) {
        console.error("PDF generation error", err);
        $w("#score").text = "An error occurred while generating your report. Please try again.";
        $w("#score").show();
    }
}
