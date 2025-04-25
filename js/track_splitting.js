

var gtracks = {}
var scrub_on = false

async function show_track_util() {
  console.log('show_track_util')

  //gtracks.visits = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
  //gtracks.tracks = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
  //gtracks.visits = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')
  gtracks.tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')
  
  convert_columns_to_number(gtracks.tracks, ['track_id','frame','pass'])

  // Sanitize pass
  for (det of gtracks.tracks) {
    det['pass'] = Math.round(det['pass'])
    det['track_key'] = `B${det['batch']}_E${det['environment']}_b${det['background']}_P${det['pass']}_T${det['track_id']}`
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
    .append("button")
      .text("Hide/Show Table")
      .on('click', () => d3.select("#table-div")
                          .style("display",
                                 () => d3.select("#table-div").style("display") === "none" ? "block" : "none")
          )
      

  d3.select('#main')
    .append("div")
    .attr('id','table-div')
    .style("max-height","300px")
    .style("overflow-y","scroll")
  create_table(gtracks.visits, ['track_key', 'track_id', 'color_id', 'background', 'batch', 'passes', 'start_frame','end_frame', 'span_frames', 'nb_samples', 'sampling_ratio'], '#table-div')

  d3.select('#table-div > table > tbody')
    .selectAll('tr>td.col_track_key')
    .html(function(d) {
      return `<a href="#" onclick="select_track('${d.track_key}')">${d.track_key}</a>`
    })

  // TRACK VIEW

  let track_container = d3.select('#main')
    .append('div')
    .attr('id','track-container')

  let buttons_div = track_container.append("div")
       .attr('id','buttons-div')

  button_div.append("button")
       .text("Select AFTER")
       .on('click', () => select('after'))
  button_div.append("button")
       .text("Select BEFORE")
       .on('click', () => select('before'))
  button_div.append("button")
       .text("Unselect AFTER")
       .on('click', () => unselect('after'))
  button_div.append("button")
       .text("Unselect BEFORE")
       .on('click', () => unselect('before'))
  button_div.append("button")
      .text("Select ALL")
      .on('click', () => unselect('all'))
  button_div.append("button")
      .text("Unselect ALL")
      .on('click', () => unselect('all'))

  track_container.append("div")
    .attr('id','track-div')
    
  d3.select('#main')
  .append("div")
  .attr('id','scrub-div')
  .style('height','50px')
  .style('background-color','blue')
  .on('mousemove', update_detail_scrub)
  .on('click', evt => toggle_scrub('toggle'))
  .html('SCRUB INIT')
  toggle_scrub(false)

  let detail_div = d3.select('#main')
  .append("div")
  .attr('id','detail-div')
  .style('display','flex')
  .style('align-items','top')
  .style("justify-content","flex-start")

  detail_div.append('img')
      //.attr('src', '/data/reid/images/'+d.new_filepath)
      .attr('style', 'width:256px; height:256px;');
  
  detail_div.append('div')
    .attr('id','detail-info')
    .attr('style', 'margin-left: 10px');
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

function update_detail_scrub(evt) {
  if (!scrub_on) { // ABORT
    return
  }

  d = evt
  //console.log(`update_detail_scrub`,evt)

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

  frame_id = d.frame_id

  //console.log(`SCRUB frame_id=${frame_id}`)

  d3.select('#detail-div > img')
      .attr("src",'/data/reid/images/'+d.new_filepath)

  d3.select('#detail-info')
      .html(`
        ${d.track_id} <br>
        ${d.frame_id} <br>
        ${d.color_id} <br>
        ${d.pass} <br>
        `)

  d3.selectAll('.item-container')
    .classed("scrubbed", d => d.frame_id == frame_id)

  d3.select('#scrub-div').html(`SCRUB ${frame_id}`)

  // Center the scrollbar
  const container = d3.select(".track-items").node();
  const target = d3.selectAll(".item-container")
        .filter(d => d.frame_id == frame_id).node();
  throttledScrollToCenter(container, target, "instant");
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
