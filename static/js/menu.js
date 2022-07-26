let dataUrl = 'https://mobeets.github.io/ksdb/';
let songList;
let item;

function filterSongs() {
  let query = $('#song-search').val().toLowerCase();
  $("#items li a").each((id, elem) => {
    if (elem.innerText.toLowerCase().indexOf(query) >= 0) {
      $(elem).parent().show();
    } else {
      $(elem).parent().hide();
    }
  });
}

function getScoreHistory() {
  // load existing history
  let history = {};
  if (localStorage.getItem('history') !== null) {
    history = JSON.parse(localStorage.getItem('history'));
  }
  return history;
}

function findBestScore(scoreHistory) {
  let maxNotesHit = 0;
  let bestScore;
  for (var i = 0; i < Object.values(scoreHistory).length; i++) {
    let curScore = Object.values(scoreHistory)[i];
    if ((curScore.totalNotes !== undefined) && (curScore.nHit > maxNotesHit)) {
      maxNotesHit = curScore.nHit;
      bestScore = curScore;
    }
  }
  return bestScore;
}

function renderBestScore(scoreHistory) {
  if (scoreHistory !== undefined) {
    let bestScore = findBestScore(scoreHistory);
    if (bestScore !== undefined) {
      let pctHit = (100*bestScore.nHit/bestScore.totalNotes).toFixed(0);
      return bestScore.nHit + '/' + bestScore.totalNotes + ' (' + pctHit + '%)';
    }
  }
  return '';
}

function itemClicked() {
  // this lets us count two adjacent clicks on the same element as a "double-click," even if they are separated in time
  let curItem = $(this).data("value");
  if (item === curItem) {
    chooseSong(curItem);
  } else {
    item = curItem;
    $('.li-item').removeClass('selected');
    $(this).addClass('selected');
  }
}

function itemDoubleClicked() {
  chooseSong($(this).data("value"));
}

function displaySongs(songNameData) {
  songList = songNameData;
  console.log(songNameData);

  let history = getScoreHistory();
  let noHistory = (Object.keys(history).length === 0);

  for (var i = 0; i < songList.length; i++) {
    let citem = '<li class="li-item" data-value="' + songList[i].value + '">';
    citem += '<a class="song-name">' + songList[i].label + '</a>';

    let cscore = renderBestScore(history[songList[i].value]);
    citem += '<span class="song-score">' + cscore + '</span></li>';
    $('#items').append(citem);
  }
  
  $('#song-search').on('input', filterSongs);
  $('.li-item').dblclick(itemDoubleClicked);
  $('.li-item').click(itemClicked); // for slower double-click
}

function fetchSongData() {
  $.ajax({
    url: dataUrl + "songs.json",
    dataType: "json",
    success: displaySongs,
  });
}

function init() {
  fetchSongData();
  $('#game').hide();
}

$(document).ready(init);
