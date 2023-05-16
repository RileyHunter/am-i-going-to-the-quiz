function getRenderFunc(canvas, segments) {
    let context = canvas.getContext('2d');
    let maxDim = Math.min(window.innerWidth, window.innerHeight - 350);
    canvas.width = maxDim;
    canvas.height = maxDim;
    let leftMargin = (window.innerWidth - maxDim) / 2;
    let padding = 10;
    let borderRadius = 20;

    let goldGradient = context.createLinearGradient(0, 0, maxDim + leftMargin, maxDim);
    goldGradient.addColorStop(0, '#FFFFFF');
    goldGradient.addColorStop(0.08, '#FFFFAC');
    goldGradient.addColorStop(0.25, '#D1B464');
    goldGradient.addColorStop(0.5, '#785c28');
    goldGradient.addColorStop(0.8, '#9f7928');
    goldGradient.addColorStop(1, '#8A6E2F');

    let segmentWidth = 2 * Math.PI / segments.length;
    let getSegmentCenter = index => (segmentWidth * index) - (segmentWidth / 2);
    let drawSegment = (
        rads,
        index,
        colour,
        text,
        fontColour,
        fontSize = 40,
        fontFace = 'Arial'
    ) => {
        let segmentCenter = getSegmentCenter(index);
        context.save();
        context.translate(maxDim / 2, maxDim / 2);
        context.rotate(segmentCenter + Math.PI / 4 + rads);
        context.beginPath();
        context.moveTo(0, 0)
        context.arc(
            0,
            0,
            (maxDim / 2) - padding - borderRadius,
            -(segmentWidth / 2),
            (segmentWidth / 2)
        );
        context.fillStyle = colour;
        context.fill();
        context.textAlign = 'center';
        context.fillStyle = fontColour;
        context.font = `${fontSize}px ${fontFace}`;
        context.fillText(text.toString(), maxDim / 4, (fontSize / 2) - 5);
        context.restore();
    }

    function subtleGradient(base) {
        let gradient = context.createLinearGradient(0, 0, maxDim + leftMargin, maxDim);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.25, base);
        gradient.addColorStop(0.75, base);
        gradient.addColorStop(1, '#000000');
        return gradient;
    }

    function* colourGenerator() {
        while (true) {
            yield subtleGradient('#fce849');
            yield subtleGradient('#ff815e');
            yield subtleGradient('#9fff5e');
            yield subtleGradient('#5ed9ff');
        }
    }

    let cG = colourGenerator();
    let colours = segments.map(() => cG.next().value);
    let currentRads = 0;
    let renderOnce = () => {
        context.beginPath();
        context.arc(maxDim / 2, maxDim / 2, (maxDim / 2) - padding, 0, 2 * Math.PI);
        context.fillStyle = goldGradient;
        context.fill();
        context.beginPath();
        context.arc(maxDim / 2, maxDim / 2, (maxDim / 2) - padding - borderRadius, 0, 2 * Math.PI);
        context.fillStyle = '#4d4d4d';
        context.fill();
        segments.forEach((i, e) => drawSegment(
            currentRads,
            e,
            colours[e],
            i.text,
            i.colour)
        );
        context.beginPath();
        context.moveTo(maxDim / 2, maxDim - padding - (borderRadius * 2));
        context.lineTo(maxDim / 2 + 20, maxDim);
        context.lineTo(maxDim / 2 - 20, maxDim);
        context.closePath();
        context.fillStyle = subtleGradient('#F00000');
        context.fill();
        context.stroke();
    }

    renderOnce();
    let isSpinning = false;

    let getSafeSpin = (rads) => {
        let currentSegmentPos = ((currentRads + segmentWidth / 2) % segmentWidth) / segmentWidth;
        let minDist = 0.05;
        let proposedSegments = rads / segmentWidth;
        let finalPosition = (proposedSegments + currentSegmentPos);
        let modulo = finalPosition % 2;
        let isSafe = modulo < (1 - minDist) && modulo > minDist;
        if (isSafe) return rads;
        let delta = finalPosition - Math.round(finalPosition);
        let closestSafe = proposedSegments - delta;
        if (modulo < 1) closestSafe += (modulo > 0.5 ? -minDist : minDist)
        else closestSafe += (modulo > 1.5 ? minDist : -minDist)
        return closestSafe * segmentWidth;

    }

    let renderFunc = (
        rads,
        durationMs,
        frameTimeMs,
        timeTransformer = (ts, duration) => Math.min(ts / duration, 1),
        smoothingSteps = Math.round(500 / frameTimeMs)
    ) => {
        rads = getSafeSpin(rads);
        if (isSpinning) return;
        isSpinning = true;
        let epsilon = 1E-4;
        let startRads = currentRads;
        let startTime = Date.now();
        let getRads = ts => (rads * timeTransformer(ts, durationMs));
        let renderStep = (decay = smoothingSteps) => {
            let currentTime = Date.now() - startTime;
            if (currentTime < durationMs) {
                setTimeout(renderStep, frameTimeMs);
                currentRads = startRads + getRads(currentTime);
            }
            else {
                let target = startRads + rads;
                let delta = target - currentRads;
                if (decay == 0 || Math.abs(delta) < epsilon) {
                    isSpinning = false;
                    currentRads = target;
                } else {
                    currentRads += delta / 10;
                    setTimeout(() => renderStep(--decay), frameTimeMs);
                }
            }
            renderOnce();
        }
        renderStep();
    }
    return renderFunc;
}

const frameTimeMs = 10;

function yesNoRepeater(n) {
    return Array(n * 4).fill().map((i, e) => { return { text: e % 2 ? 'No :(' : 'Yes :)', colour: e % 2 ? 'red' : 'black' } });
}

let renderFunc = getRenderFunc(document.getElementById('rouletteCanvas'), yesNoRepeater(3));


let makeSigmoid = c => {
    return (ts, duration) => {
        let x = ts / duration;
        x = x + .5;
        return 1 / (1 + Math.E ** -(c * x - c / 2));
    }
}

let spinButton = document.getElementById('spinButton');
let startTime = null;
let timeoutId;
let blockNextPointerUp = false;
let minRads = 4;
let maxRads = 40;
let maxHoldTime = 3000;
let minSpinTime = 2000;
let maxSpinTime = 5000;

let buttonMinSize = 200;
let buttonMaxSize = 300;
let buttonStartColour = [230, 230, 230];
let buttonEndColour = [224, 4, 100];

let makeColourString = arr => `rgb(${arr.join(',')})`;

let rotateMaxHz = 40;
let rotateMaxRads = 0.2;

function interp(fraction, start, end) {
    return start + (fraction * (end - start));
}

let getRotation = fraction => {
    let targetHz = interp(fraction, 0, rotateMaxHz);
    let targetXVal = targetHz / Math.PI;
    let raw = Math.sin(targetXVal ** 2) * rotateMaxRads;
    return `rotate(${raw}rad)`;
}

function makeButtonSexier() {
    if (!startTime) return;
    let fraction = Math.min((Date.now() - startTime) / maxHoldTime, 1)
    let buttonWidth = interp(fraction, buttonMinSize, buttonMaxSize);
    spinButton.style.width = spinButton.style.height = `${buttonWidth}px`;
    let colourArray = Array(3).fill().map((_, e) => interp(fraction, buttonStartColour[e], buttonEndColour[e]));
    spinButton.style.backgroundColor = makeColourString(colourArray);
    spinButton.style.transform = getRotation(fraction);
    setTimeout(makeButtonSexier, frameTimeMs);
};

function resetButton() {
    spinButton.style.width = spinButton.style.height = `${buttonMinSize}px`;
    spinButton.style.backgroundColor = makeColourString(buttonStartColour);
    spinButton.style.transform = 'rotate(0)';
}

function onHold(e) {
    startTime = Date.now();
    timeoutId = setTimeout(() => forceRelease(e.target), maxHoldTime);
    makeButtonSexier();
};

function forceRelease(target) {
    target.dispatchEvent(new Event('pointerup'));
    blockNextPointerUp = true;
};

function onRelease() {
    if (blockNextPointerUp) {
        blockNextPointerUp = false;
        return;
    }
    resetButton();
    clearTimeout(timeoutId)
    let releaseTime = Date.now() - startTime;
    let fraction = Math.min(releaseTime / maxHoldTime, 1);
    let rads = interp(fraction, minRads, maxRads);
    let spinTime = interp(fraction, minSpinTime, maxSpinTime);
    startTime = null;
    renderFunc(rads, spinTime, frameTimeMs, makeSigmoid(13));
};


spinButton.onpointerdown = onHold;
spinButton.onpointerup = onRelease;
resetButton();