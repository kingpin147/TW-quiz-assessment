import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { generateAssessmentPDF } from 'backend/pdfGenerator';
import { currentMember } from "wix-members-frontend";

let answers = []; // { index, value }
let chartDataUrl = ""; // base64 from HTML component
let fullName = "Anonymous"; // Default fallback name
const options = { fieldsets: ['FULL'] };

$w.onReady(async () => {
    $w("#score").hide();
    try {
        const member = await currentMember.getMember(options);
        const { firstName, lastName } = member.contactDetails || {};
        if (firstName && lastName) {
            fullName = `${firstName} ${lastName}`;
        }
    } catch (error) {
        console.warn("Could not retrieve member info. Using anonymous.");
    }

    // Listen for the chart image from the HTML component
    $w("#html1").onMessage(event => {
        if (event.data && event.data.chartImage) {
            chartDataUrl = event.data.chartImage;
        }
    });

    // Load quiz questions
    await wixData.query("Assesment")
        .find()
        .then(results => {
            results.items.forEach((item, i) => {
                $w(`#questionText${i+1}`).text = item.assessmentQuestion;
                $w(`#radioGroup${i+1}`).options = [
                    { label: item.option1, value: "A" },
                    { label: item.option2, value: "B" },
                    { label: item.option3, value: "C" },
                ];
                $w(`#radioGroup${i+1}`).onChange(e => {
                    const existing = answers.find(a => a.index === i);
                    if (existing) existing.value = e.target.value;
                    else answers.push({ index: i, value: e.target.value });
                    e.target.disable();
                });
            });
            updateButtons(1);
        })
        .catch(console.error);
});

// Button visibility & label
function updateButtons(stateIndex) {
    if (stateIndex === 1) {
        $w("#back").hide();
        $w("#next").label = "Next";
        $w("#next").show();
    } else if (stateIndex === 24) {
        $w("#back").show();
        $w("#next").label = "Submit";
        $w("#next").show();
    } else if (stateIndex === 25) {
        $w("#back").hide();
        $w("#next").hide();
    } else {
        $w("#back").show();
        $w("#next").label = "Next";
        $w("#next").show();
    }
}

// Back navigation
$w("#back").onClick(() => {
    const curr = +$w("#multiStateBox").currentState.id.replace("State", "");
    const prev = curr - 1;
    $w("#multiStateBox").changeState(`State${prev}`);
    updateButtons(prev);
});

// Next / Submit
$w("#next").onClick(async () => {
    const curr = +$w("#multiStateBox").currentState.id.replace("State", "");

    // Just advance through questions
    if (curr < 24) {
        const next = curr + 1;
        $w("#multiStateBox").changeState(`State${next}`);
        updateButtons(next);
        return;
    }

    // Validate all answered
    if (answers.length < 24) {
        $w("#score").text = "Please answer all questions before submitting.";
        $w("#score").show();
        return;
    }
    $w("#score").hide();

    // Compute percentages
    let fixer = 0,
        reactor = 0,
        impactor = 0;
    answers.forEach(a => {
        if (a.value === "A") fixer++;
        else if (a.value === "B") reactor++;
        else impactor++;
    });
    const toPct = n => Math.round((n / 24) * 100);
    const fixerPct = toPct(fixer);
    const reactorPct = toPct(reactor);
    const impactorPct = toPct(impactor);

    // Render chart in iframe
    $w("#html1").postMessage({ fixerPct, reactorPct, impactorPct });

    // Show textual results
    $w("#score").text =
        `Fixer: ${fixerPct}% | Reactor: ${reactorPct}% | Impactor: ${impactorPct}%`;
    $w("#score").show();

    // Enter “please wait” state
    $w("#multiStateBox").changeState("State25");
    updateButtons(25);

    // Give the iframe ~1s to render & post back chartImage
    await new Promise(r => setTimeout(r, 1000));

    // Generate PDF (pass chartDataUrl alongside answers)
    try {
        const { downloadUrl } = await generateAssessmentPDF(
            fullName,
            answers,
            chartDataUrl
        );
        wixLocation.to(downloadUrl);
    } catch (err) {
        console.error("PDF error", err);
        $w("#score").text = "An error occurred while generating the PDF. Please try again later.";
        $w("#score").show();
        // Do not revert to State24
    }
});