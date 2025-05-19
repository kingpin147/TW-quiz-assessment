import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { generateAssessmentPDF } from 'backend/pdfGenerator';

let answers = [];
let chartDataUrl = "";
let chartReceived = false;
let fixerPct, reactorPct, impactorPct;
let name;

$w.onReady(async () => {
    $w("#score").hide();
    $w("#back").hide();
    $w("#next").hide();

    // 🟢 START BUTTON HANDLER (State0)
    $w("#start").onClick(() => {
        name = $w("#fname").value.trim();
        if (!name) {
            $w("#score").text = "Please enter your full name before starting.";
            $w("#score").show();
            return;
        }
        $w("#score").hide();
        $w("#multiStateBox").changeState("State1");
        updateButtons(1);
    });

    // 📩 Listen for chart image from iframe once
    $w("#html1").onMessage(async (event) => {
        if (!chartReceived && event.data?.chartImage) {
            chartReceived = true;
            chartDataUrl = event.data.chartImage;
            await generatePDF();
            $w("#THANK").text = "Thank You for attempting this assessment.";
        }
    });

    // 📚 Load and assign quiz questions
    const results = await wixData.query("Assesment").find();
    const sortedItems = results.items
        .filter(item => item.text && !isNaN(parseInt(item.text)))
        .sort((a, b) => parseInt(a.text) - parseInt(b.text));

    sortedItems.forEach((item, i) => {
        const index = i + 1;
        const questionText = $w(`#questionText${index}`);
        const radioGroup = $w(`#radioGroup${index}`);

        if (questionText && radioGroup) {
            questionText.text = item.assessmentQuestion;
            radioGroup.options = [
                { label: item.option1, value: "A" },
                { label: item.option2, value: "B" },
                { label: item.option3, value: "C" },
            ];
            radioGroup.onChange(e => {
                const existing = answers.find(a => a.index === index);
                if (existing) {
                    existing.value = e.target.value;
                } else {
                    answers.push({ index: index, value: e.target.value });
                }
                e.target.disable();
            });
        }
    });
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

        // Debug info (optional)
        console.log("Answers collected:", answers.map(a => a.index));
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

// 🔙 BACK BUTTON
$w("#back").onClick(() => {
    const curr = +$w("#multiStateBox").currentState.id.replace("State", "");
    if (curr > 1 && curr <= 25) {
        const prev = curr - 1;
        $w("#multiStateBox").changeState(`State${prev}`);
        updateButtons(prev);
    }
});

// 🎯 BUTTON VISIBILITY CONTROLLER
function updateButtons(stateIndex) {
    if (stateIndex === 0) {
        $w("#back").hide();
        $w("#next").hide();
    } else if (stateIndex === 1) {
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

// 🧾 PDF GENERATION
async function generatePDF() {
    const today = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });

    try {
        const { downloadUrl } = await generateAssessmentPDF(
            name,       // participantName
            answers,    // answersArray
            chartDataUrl, 
            today,      // dateStr
            {           // scores
                fixerPct,
                reactorPct,
                impactorPct
            }
        );
        wixLocation.to(downloadUrl);
    } catch (err) {
        console.error("PDF generation error", err);
        $w("#score").text = "An error occurred while generating your report. Please try again.";
        $w("#score").show();
    }
}