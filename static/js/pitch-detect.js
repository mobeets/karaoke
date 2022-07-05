
function detectPitch(fft) {
  var timeDomain = fft.waveform(1024, 'float32');
  var corrBuff = autoCorrelate(timeDomain);
  return findFrequency(corrBuff);
}

// accepts a timeDomainBuffer and multiplies every value
function autoCorrelate(timeDomainBuffer) {
  
  var nSamples = timeDomainBuffer.length;

  // pre-normalize the input buffer
  if (opts.preNormalize){
    timeDomainBuffer = normalize(timeDomainBuffer);
  }

  // zero out any values below the centerClipThreshold
  if (opts.doCenterClip) {
    timeDomainBuffer = centerClip(timeDomainBuffer);
  }

  var autoCorrBuffer = [];
  for (var lag = 0; lag < nSamples; lag++){
    var sum = 0; 
    for (var index = 0; index < nSamples; index++){
      var indexLagged = index+lag;
      if (indexLagged < nSamples){
        var sound1 = timeDomainBuffer[index];
        var sound2 = timeDomainBuffer[indexLagged];
        var product = sound1 * sound2;
        sum += product;
      }
    }

    // average to a value between -1 and 1
    autoCorrBuffer[lag] = sum/nSamples;
  }

  // normalize the output buffer
  if (opts.postNormalize){
    autoCorrBuffer = normalize(autoCorrBuffer);
  }

  return autoCorrBuffer;
}


// Find the biggest value in a buffer, set that value to 1.0,
// and scale every other value by the same amount.
function normalize(buffer) {
  var biggestVal = 0;
  var nSamples = buffer.length;
  for (var index = 0; index < nSamples; index++){
    if (abs(buffer[index]) > biggestVal){
      biggestVal = abs(buffer[index]);
    }
  }
  for (var index = 0; index < nSamples; index++){

    // divide each sample of the buffer by the biggest val
    buffer[index] /= biggestVal;
  }
  return buffer;
}

// Accepts a buffer of samples, and sets any samples whose
// amplitude is below the centerClipThreshold to zero.
// This factors them out of the autocorrelation.
function centerClip(buffer) {
  var nSamples = buffer.length;

  // center clip removes any samples whose abs is less than centerClipThreshold
  centerClipThreshold = map(mouseY, 0, height, 0, 1);

  if (centerClipThreshold > 0.0) {
    for (var i = 0; i < nSamples; i++) {
      var val = buffer[i];
      buffer[i] = (Math.abs(val) > centerClipThreshold) ? val : 0;
    }
  }
  return buffer;
}

// Calculate the fundamental frequency of a buffer
// by finding the peaks, and counting the distance
// between peaks in samples, and converting that
// number of samples to a frequency value.
function findFrequency(autocorr) {

  var nSamples = autocorr.length;
  var valOfLargestPeakSoFar = 0;
  var indexOfLargestPeakSoFar = -1;

  for (var index = 1; index < nSamples; index++){
    var valL = autocorr[index-1];
    var valC = autocorr[index];
    var valR = autocorr[index+1];

    var bIsPeak = ((valL < valC) && (valR < valC));
    if (bIsPeak){
      if (valC > valOfLargestPeakSoFar){
        valOfLargestPeakSoFar = valC;
        indexOfLargestPeakSoFar = index;
      }
    }
  }
  
  var distanceToNextLargestPeak = indexOfLargestPeakSoFar - 0;

  // convert sample count to frequency
  var fundamentalFrequency = sampleRate() / distanceToNextLargestPeak;
  return fundamentalFrequency;
}
