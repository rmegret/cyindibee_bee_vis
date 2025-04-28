

var gtracks = {}
var scrub_on = false
var show_features = false

async function show_track_util() {
  console.log('show_track_util')

  d3.select('#main').html('')

  //gtracks.visits = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
  //gtracks.tracks = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
  gtracks.tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')
  //gtracks.tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch2_sample_num_max.csv')
  
  convert_columns_to_number(gtracks.tracks, ['key','track_id','frame','pass'])

  // Sanitize pass
  for (det of gtracks.tracks) {
    det['pass'] = Math.round(det['pass'])
    det['track_key'] = `B${det['batch']}_E${det['environment']}_b${det['background']}_P${det['pass']}_r${det['bee_range']}_T${det['track_id']}`
  }

  function agg(g) {
    item = g[0]
    let start_frame = d3.min(g, d => d.frame_id )
    let end_frame = d3.max(g, d => d.frame_id )
    let nb_samples = g.length
    let span_frames = end_frame-start_frame+1
    let passes = [...new Set(g.map(d => d.pass))]
    return {
      track_key: item['track_key'],
      track_id: item['track_id'],
      background: item['background'],
      color_id: item['color_id'],
      batch: item['batch'],
      passes: passes,
      bee_range: item['bee_range'],
      environment: item['environment'],
      crop_filename: item['new_filepath'],
      video: item['new_filepath'].split('.')[0]+'.mp4',
      start_frame: start_frame,
      end_frame: end_frame,
      span_frames: span_frames,
      nb_samples: nb_samples,
      sampling_ratio: nb_samples / span_frames
    }
  }

  nested = d3.rollup(gtracks.tracks, agg, d => d.track_key);
  const flat = [];
  for (const [track_key, item] of nested) {
    //console.log(item)
    item['track_key'] = track_key
    flat.push(item);
  }
  gtracks.visits = flat

  // TABLE
  let buttons_div = d3.select('#main')
    .append("div")
       .attr('id','buttons-div')
       buttons_div.append("button")
       .text("Hide/Show Table")
       .on('click', () => d3.select("#table-div")
                           .style("display",
                                  () => d3.select("#table-div").style("display") === "none" ? "block" : "none")
           )
           buttons_div.append("button")
      .text("Hide/Show Features")
      .on('click', function () {show_features = !show_features;})
      

  let top_div = d3.select('#main')
    .append('div').attr('id','top-div')
  
  top_div.append("div")
    .attr('id','table-div')
    .style("max-height","300px")
    .style("overflow-y","scroll")
    .style("overflow-x","scroll")
    .style("width","50%")
  create_table(gtracks.visits, ['track_key', 'track_id', 'color_id', 'background', 'batch', 'bee_range', 'passes', 'start_frame','end_frame', 'span_frames', 'nb_samples', 'sampling_ratio'], '#table-div')

  d3.select('#table-div > table > tbody')
    .selectAll('tr>td.col_track_key')
    .html(function(d) {
      return `<a href="#" onclick="select_track('${d.track_key}')">${d.track_key}</a>`
    })

  // TRACK VIEW

  let track_container = d3.select('#main')
    .append('div')
    .attr('id','track-container')

    d3.select('#track-container')
    .on('keydown', (evt) => onkeydown(evt))
    .attr("tabindex", "0")

  let buttons_div_select = track_container.append("div")
       .attr('id','buttons-div');

  buttons_div_select.append("button")
       .text("Select AFTER")
       .on('click', () => select('after'))
  buttons_div_select.append("button")
       .text("Select BEFORE")
       .on('click', () => select('before'))
  buttons_div_select.append("button")
  .text("Unselect AFTER")
  .on('click', () => unselect('after'))
  buttons_div_select.append("button")
  .text("Unselect BEFORE")
  .on('click', () => unselect('before'))
  buttons_div_select.append("button")
  .text("Select ALL")
  .on('click', () => unselect('all'))
  buttons_div_select.append("button")
  .text("Unselect ALL")
  .on('click', () => unselect('all'))

  track_container.append("div")
    .attr('id','track-div')
    
  d3.select('#main')
  .append("div")
  .attr('id','scrub-div')
  .style('height','50px')
  .style('background-color','blue')
  .on('mousemove', scrub_mousemove)
  .on('click', evt => toggle_scrub('toggle'))
  .html('SCRUB INIT')
  toggle_scrub(false)

  d3.select("#main")
     .append("canvas")
     .attr("id","csvCanvas")
     .style('image-rendering','pixelated')

  let detail_div = top_div.append("div")
    .attr('id','detail-div')
    .style('width','45%')
    .style('display','flex')
    .style('align-items','top')
    .style("justify-content","flex-start")

  detail_div.append('img')
      //.attr('src', '/data/reid/images/'+d.new_filepath)
      .attr('style', 'width:256px; height:256px;');
  
  detail_div.append('div')
    .attr('id','detail-info')
    .attr('style', 'margin-left: 10px');

  let detail_div2 = top_div.append("div")
    .attr('id','detail-div2')
    .style('width','45%')
    .style('display','flex')
    .style('align-items','top')
    .style("justify-content","flex-start")

  detail_div2.append('img')
      //.attr('src', '/data/reid/images/'+d.new_filepath)
      .attr('style', 'width:256px; height:256px;');
  
  detail_div2.append('div')
    .attr('id','detail-info2')
    .attr('style', 'margin-left: 10px');
  
  detail_div.append("button")
    .text("Set as reference")
    .on('click', () => set_scrub_as_reference())
}

function get_item(key) {
  return gtracks.track.filter(det => det.key == key)[0]
}

function onkeydown(evt) {
  if (evt.code=='ArrowRight') {
    //console.log(evt)
    let track = gtracks.track.filter(det => det.key > gtracks.scrub_item.key)
    if (track.length==0) {console.log('Already at start, ABORT'); return}
    let new_item = track[0]
    console.log(gtracks.scrub_item.key, new_item.key)
    scrub_to(new_item, true)
    evt.preventDefault();
    evt.stopPropagation()
  }
  if (evt.code=='ArrowLeft') {
    //console.log(evt)
    let track = gtracks.track.filter(det => det.key < gtracks.scrub_item.key)
    if (track.length==0) {console.log('Already at end, ABORT'); return}
    let new_item = track[track.length-1]
    console.log(gtracks.scrub_item.key, new_item.key)
    scrub_to(new_item, true)
    evt.preventDefault();
    evt.stopPropagation()
  }
}


function select(where) {
  let track = gtracks.tracks.filter(det => det.track_key == track_key)

  if (where == 'all') {

  }
  d3.selectAll('.item-container')
      .classed("selected", d => d.selected)
}

async function select_track(track_key) {
  console.log(`select_track(${track_key})`)

  gtracks.track_key = track_key

  let track = gtracks.tracks.filter(det => det.track_key == track_key)

  gtracks.track = track

  // Add a container for the images in this 'track_key'
  d3.select('#track-div').html('').append('div')
  .attr('class', 'track-items')
  .style('display', 'flex') // Use flexbox for horizontal layout
  .style('flex-wrap', 'nowrap') // Prevent wrapping of images
  .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
  .style('white-space', 'nowrap') // Ensure images stay on one line
  .selectAll('.item-container')
  .data(track) // Use the items in this 'track_key'
  .join('div')
    .attr('class', 'item-container')
    .style('text-align', 'center') // Center-align the content
    .style('margin', '5px') // Add some spacing between items
    .each(function(d) {
        const container = d3.select(this);

        // Add the image
        container
            .append('img')
            .attr('class', d => `crop-img`)
            .attr('frame_id', d.frame_id)
            .attr('src', '/data/reid/images/'+d.new_filepath)
            .attr('style', 'width:128px; height:128px; display:block; margin:auto;')
            .on('click', update_detail_img_click)

        // Add the frame ID below the image
        container.append('div')
            .attr('class', 'frame-id')
            .text(`Frame: ${d.frame_id}`)
            .style('margin-top', '5px') // Add spacing above the text
            .style('font-size', '12px') // Adjust font size
            .style('color', '#555'); // Optional: Change text color
  });

  if (show_features)
    draw_features()
}


function throttleTrailing(fn, interval) {
  let lastTime = 0;
  let timeout = null;
  let lastArgs = null;

  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else {
      lastArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          lastTime = Date.now();
          fn.apply(this, lastArgs);
          timeout = null;
        }, remaining);
      }
    }
  };
}

function scrollToCenter(container, target, scrollBehavior = "smooth") {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const scrollLeft = container.scrollLeft + 
    (targetRect.left + targetRect.width / 2) - 
    (containerRect.left + containerRect.width / 2);

  const scrollTop = container.scrollTop + 
    (targetRect.top + targetRect.height / 2) - 
    (containerRect.top + containerRect.height / 2);

  container.scrollTo({ left: scrollLeft, top: scrollTop, 
                        behavior: scrollBehavior });
}
throttledScrollToCenter = throttleTrailing(scrollToCenter, 100)


function scrub_mousemove(evt) {
  if (!scrub_on) { // ABORT
    return
  }
  //console.log(`scrub_mousemove`,evt)

  const rect = evt.srcElement.getBoundingClientRect();
  const x = evt.clientX - rect.left;

  idx = Math.floor(x / rect.width * gtracks.track.length)

  d = gtracks.track[idx]
  scrub_to(d)
}

function scrub_to(d, force=false) {
  if ((!force) & (!scrub_on)) { // ABORT
    return
  }

  gtracks.scrub_item = d

  //console.log(`SCRUB frame_id=${frame_id}`)

  scrub_update_detail()
}

function scrub_update_detail() {
  let d = gtracks.scrub_item

  // DETAIL
  d3.select('#detail-div > img')
  .attr("src",'/data/reid/images/'+d.new_filepath)

  d3.select('#detail-info')
    .html(`
      ${d.track_id} <br>
      ${d.frame_id} <br>
      ${d.color_id} <br>
      ${d.pass} <br>
      `)

  // TRACK DIV
  let frame_id = d.frame_id
  d3.selectAll('.item-container')
  .classed("scrubbed", d => d.frame_id == frame_id)

  // SCRUB DIV
  d3.select('#scrub-div').html(`SCRUB ${frame_id}`)

  // TRACK VIEW SCROLL TO CENTER
  frame_id = d.frame_id
  const container = d3.select(".track-items").node();
  const target = d3.selectAll(".item-container")
        .filter(d => d.frame_id == frame_id).node();
  throttledScrollToCenter(container, target, "instant");
}


function set_scrub_as_reference() {
  gtracks.reference_item = gtracks.scrub_item
  update_detail2()
}

function update_detail2() {
  let d = gtracks.reference_item

  // DETAIL2
  d3.select('#detail-div2 > img')
  .attr("src",'/data/reid/images/'+d.new_filepath)

  d3.select('#detail-info2')
    .html(`
      ${d.track_id} <br>
      ${d.frame_id} <br>
      ${d.color_id} <br>
      ${d.pass} <br>
      `)
}

function toggle_scrub(_scrub_on = 'toggle') {
  if (_scrub_on == 'toggle')
    scrub_on = !scrub_on
  else
    scrub_on = _scrub_on
  
  if (scrub_on) {
    d3.select('#scrub-div')
      .html(`SCRUB ON`)
      .style('background-color','green')
  } else {
    d3.select('#scrub-div')
      .html(`SCRUB OFF - Click to activate`)
      .style('background-color','lightgray')
  }
}

function update_detail_img_click(evt) {
  console.log(`update_detail`,evt)
  clicked_d = evt.srcElement.__data__
  //d3.select('#detail-div > img')
  //    .attr("src",'/data/reid/images/'+d.new_filepath)
  if (evt.shiftKey) {// multi-selection
    clicked_d.selected = !clicked_d.selected
    console.log(`update_detail`,clicked_d)
    d3.selectAll('.item-container')
      .filter(d => d.frame_id == clicked_d.frame_id)
      .classed("selected", d => d.selected)
  } else
    scrub_to(clicked_d, true)
}


async function draw_features() {
  //data = await d3.csv('/data/reid/batch_1_train_embeddings_26w82ua9.csv')
  data = await d3.csv('/data/reid/batch_2_test_embeddings_26w82ua9.csv')
  gtracks.features = data

  const featureKeys = Array.from({ length: 128 }, (_, i) => `feature_${i}`);
  const rows = data.map(row => featureKeys.map(key => parseFloat(row[key])));
  //const indices = data.map(row => +row['key']);

  rows2 = gtracks.track.map(det => rows[det.key])
  console.log(rows2)

  // Normalize the data to the range [0, 255] for pixel intensity
  const flattened = rows2.flat();
  const min = d3.min(flattened);
  const max = d3.max(flattened);
  const normalizedRows = rows2.map(row =>
    row.map(value => Math.round(((value - min) / (max - min)) * 255))
  );

  const canvas = document.getElementById("csvCanvas");
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;

  const height = 128+10; // Number of features
  const width = normalizedRows.length; // Number of rows in the CSV
  canvas.width = width;
  canvas.height = height;

  // Create an ImageData object
  const imageData = context.createImageData(width, height);
  const pixels = imageData.data;

  // Fill the ImageData object with pixel values
  normalizedRows.forEach((row, x) => {
    row.forEach((value, y) => {
      const index = (y * width + x) * 4; // Each pixel has 4 values (RGBA)
      pixels[index] = value; // Red
      pixels[index + 1] = value; // Green
      pixels[index + 2] = value; // Blue
      pixels[index + 3] = 255; // Alpha (fully opaque)
    });
    for (y=0; y<10; y++) {
      const index = ((y+128) * width + x) * 4; // Each pixel has 4 values (RGBA)
      pixels[index] = (x%2)*255; // Red
      pixels[index + 1] = (Math.floor(x)%2)*255; // Green
      pixels[index + 2] = (Math.floor(x)%2)*255; // Blue
      pixels[index + 3] = 255; // Alpha (fully opaque)
    }
  });

  // Put the ImageData onto the canvas
  context.putImageData(imageData, 0, 0);

  d3.select("#csvCanvas")
     .style('width','100%')
     .style('height','128px')
}