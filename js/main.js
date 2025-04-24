// Global variable to help debugging
var gdebug = {}


// UTILITARY FUNCTIONS

// Converts in place specified columns of data rows into numbers
// data[i]['colname'] becomes a number
function convert_columns_to_number(data, columns) {
  for (row of data) {
    for (column of columns) {
      row[column] = +row[column]
    }
  }
}
// Convert a flat list of rows into an indexed dictionnary
// [{a:1, b:30}, {a:10, b:40}] => {1: {a:1, b:30}, 10: {a:10, b:40}}
// The new structure points to the old structure, it just index it
// So that any modification to the items of `indexed_data` modifies `data`
function index_table(data, index_column) {
  indexed_data = {}
  for (row of data) {
    indexed_data[row[index_column]] = row // Allow indexed access to the data
  }
  return indexed_data
}

// Function to be used in list.sort() to sort by multiple fields
// in a list of objects [{a:1, b:10},{a:2,b:30}...]
function sortByMultipleProperties(properties) {
  return function (a, b) {
    for (let prop of properties) {
      let dir = 1;
      if (prop[0] === '-') {
        dir = -1;
        prop = prop.slice(1);
      }
      if (a[prop] < b[prop]) return -1 * dir;
      if (a[prop] > b[prop]) return 1 * dir;
    }
    return 0;
  };
}

// Generic table creation
function create_table(data, headers, parent_selector = "#main") {
  d3.select('#msg').html('create_table...')

  d3.select(parent_selector).html('') // Empty the parent (typically '#main')

  // Create table with headers
  let table = d3.select(parent_selector).append('table')
  table.append("thead").append("tr")
    .selectAll("th")
    .data(headers)
    .enter().append("th")
    .text(function(d) {
      return d;
      })

  // Create one row per item in data
  let rows = table.append("tbody")
    .selectAll("tr")
    .data(data)
    .enter()
    .append("tr")
      .attr('class', (row, row_id) => 'row_'+row_id)  // Add class to reach row content
  
  // For each column, tell each row to add a horizontal cell, using the corresponding second level data
  for (col_name of headers) {
    rows.append("td") //Name Cell
        .attr('class', 'col_'+col_name)  // Add class to reach cell content
        .text(row => row[col_name])  // row is data[row_id]
  }

  d3.select('#msg').html('create_table... done')
}


// FLOWERPATCH DEMO

async function show_visits_table() {
  console.log('show_visits_table')
  data = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
  // Note: Async call to load_data: the rest of the function is actually called as a callback after data has been loaded
  
  create_table(data, ['track_id','bee_id','flower_id','start_frame','end_frame'])
}

async function show_flowers_table() {
  console.log('show_flowers_table')

  data = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.flowers.csv')

  create_table(data, ['flower_id','color','cx','cy','idx','idy'], "#main")

  // Add custom color vis
  d3.select('#main > table > tbody')
    .selectAll('tr>td.col_color')
    .html(function(d) {
      return `<div style="width: 1em; height: 1em; border: 1px solid black; background-color: ${d.color}; display: inline-block;"></div> ${d.color}`
    })
}

async function show_bee_labels_table() {
  console.log('show_bee_labels_table')
  
  data = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv')
  // Async call to load_data: the rest of the function is actually called as a callback after data has been loaded

  create_table(data, ['bee_id','paint_color','paint_size','paint_shape','comment'], "#main")

  // Add custom color vis
  d3.select('#main > table > tbody')
    .selectAll('tr>td.col_paint_color')
    .html(function(d) {
      return `<div style="width: 1em; height: 1em; border: 1px solid black; background-color: ${d.paint_color}; display: inline-block;"></div> ${d.paint_color}`
    })
  
}

async function show_detections_table(show_images=false, only_with_crops=false) {
  console.log('show_detections_table')

  data = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
  // Async call to load_data: the rest of the function is actually called as a callback after data has been loaded

  convert_columns_to_number(data, ['track_id','frame'])
  // Sort to have each track grouped sequentially, then ordered by frame number
  data = data.sort(sortByMultipleProperties(['track_id','frame']))

  // Filter to keep only detections with a crop
  if (only_with_crops) {
    data = data.filter(d => d.crop_filename!='')
  }

  create_table(data, ['track_id','frame','flower_id','cx','cy','crop_filename'], "#main")
  
  var div = d3.select('#main').insert("div",":first-child")  // Prepend button callback before table
  div.append("button")
    .on('click', () => show_detections_table(!show_images, only_with_crops)) 
    .text("Toogle images")
  div.append('button') 
    .on('click', () => show_detections_table(show_images, !only_with_crops)) 
    .text("Toogle filter 'has crop'")

  // Add image in column crop_filename if non empty
  if (show_images) {
    d3.select('#main > table > tbody')
    .selectAll('tr>td.col_crop_filename')
    .html(function(d) {
      if ((d.crop_filename == undefined)||(d.crop_filename == '')) {
        return `no img`
      }
      return `<div>${d.crop_filename}</div><div><img src="${'data/flowerpatch/crops/'+d.crop_filename}" style="width:128px; height:128px;"/></div>`
    })
  }

  console.log('DONE (for large table, rendering may lag after creation)')
}


async function show_visits_with_bee_labels_table(show_crop_filenames=true, show_images=false) {
  console.log('show_visits_with_bee_labels_table')

  // How to load multiple datasets
  // Sequentially (first load visits, then labels)
  //data_visits = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
  //data_labels = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv')

  // In parallel (since d3.csv is async, both files are requested at once)
  promise = Promise.all( 
    [d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv'),
    d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv')
    ] )
  const [data_visits, data_bees] = await promise
  gdebug.data_visits = data_visits

  // Ensure correct data type for key columns (also helps with proper numerical sorting)
  convert_columns_to_number(data_visits, ['bee_id'])
  convert_columns_to_number(data_bees, ['bee_id','track_id'])

  // MERGING OF THE BEE INFORMATION

  // Create an indexed object/mapping to use as extra info for the visits
  // Add Bee #0, which appears when there is no assigned bee
  indexed_bees = index_table(data_bees, 'bee_id')
  indexed_bees[0] = {bee_id:0, 
    paint_color:undefined, paint_size:undefined, paint_shape:undefined,
    comment:'undefined bee'}

  // Append bee labels to visits table
  for (visit of data_visits) {
    let bee = indexed_bees[visit['bee_id']]
    // copy relevant data from the labels table
    visit['paint_color'] = bee['paint_color'] // copy relevant data from the labels table
    visit['comment'] = bee['comment'] 

    // Could also reference the complete row, but does not work with generic create_table
    visit['bee_labels'] = bee
  }

  // OPTIONAL: MERGING OF THE IMAGE CROPS TAKEN FROM THE TRACKS TABLE
  if (show_crop_filenames) {
    data_tracks = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
    convert_columns_to_number(data_tracks, ['track_id'])

    // Append first crop_filename found in data_tracks into visits_table
    indexed_visits = index_table(data_visits, 'track_id')
    for (detection of data_tracks) {
      visit = indexed_visits[detection['track_id']]
      if ((!!detection['crop_filename']) && (!visit?.crop_filename)) {// If crop_filename not defined yet and detection has it defined, copy it to the visits table
        visit['crop_filename'] = detection['crop_filename'] // Allow indexed access to the data
      }
    }
    gdebug.data_visits = data_visits
  }

  // DISPLAY AFTER MERGING
  if (show_crop_filenames)
     create_table(data_visits, ['track_id','bee_id','paint_color','comment','crop_filename'], "#main")
  else
     create_table(data_visits, ['track_id','bee_id','paint_color','comment'], "#main")
  
  // Add buttons to control crop_filename column
  var div = d3.select('#main').insert("div",":first-child")  // Prepend button callback before table
  div.append("button")
    .on('click', function () {
      show_images = !show_images
      if (show_images) show_crop_filenames=true // Need to show the column to show images
      show_visits_with_bee_labels_table(show_crop_filenames, show_images)
    })
    .text("Toogle images")
  div.append('button') 
    .on('click', () => show_visits_with_bee_labels_table(!show_crop_filenames, show_images)) 
    .text("Toogle crop column")

  if (show_crop_filenames && show_images) {
    // And convert to image
    d3.select('#main > table > tbody')
    .selectAll('tr>td.col_crop_filename')
    .html(function(d) {
      if ((d.crop_filename == undefined)||(d.crop_filename == '')) {
        return `no img`
      }
      return `<div style="display: flex; align-items: center; gap: 8px;">
              <span>${d.crop_filename}</span>
              <img src="${'data/flowerpatch/crops/'+d.crop_filename}" style="width:64px; height:64px;"/>
              </div>`
    })
  }

  console.log('DONE (for large table, rendering may lag after creation)')
}


async function show_video_frame() {
  console.log('show_video_frame')

  d3.select('#msg').html('Video Frame...')

  // Video frame information
  width = 2816
  height = 2816
  frame_filename = '/data/flowerpatch/flowerpatch_20240606_11h04_frame_0.jpg'

  // Clear Main
  var mainDiv = d3.select('#main')
  mainDiv.html('')

  // Add as a simple image tag
  // mainDiv.append('p').text('Plain <img> (cannot paint on it)')
  // mainDiv.append('img')
  //   .attr("src", frame_filename)
  //   .style("width","100%")
  //   .style("height","auto")

  // Image inside SVG to be able to plot on it
  mainDiv.append('p').text('SVG canvas (can add overlay elements to it)')
  var svg = mainDiv.append("svg")
    .attr("class","flowerpatch")
    .attr('viewBox',`0 0 ${width} ${height}`)  // To be able to scale the content of the SVG with the SVG
    .style("width","100%")
    .style("height","auto")
    .attr('preserveAspectRatio',"xMidYMid slice")
    .attr('xmlns',"http://www.w3.org/2000/svg")

  svg.append('image')
  .attr('href',frame_filename)
  .attr('x',0)
  .attr('y',0)
  .attr('width',width)
  .attr('height',height)

  // Overlay the flowers on top of the image
  data = await d3.csv('/data/flowerpatch/flowerpatch_20240606_11h04.flowers.csv')
  console.log(data)
  
  svg.selectAll("circle")
  .data(data)
  .join("circle")
    .attr("cx",d=>d.cx)
    .attr("cy",d=>d.cy)
    .attr("r",100)
    .attr("stroke","red")
    .attr("stroke-width","10px")
    .attr("fill","none")

  svg.selectAll("text")
    .data(data)
    .join("text")
      .attr("x",d=>d.cx)
      .attr("y",d=>d.cy)
      .text(d=>d.flower_id)
      .attr("fill"," red")
      .style('font-size','120px')
      .style('font-family','monospace')
      .style('font-weight','bold')
      .style('text-anchor','middle')
      //.style('dominant-baseline','middle')
      .attr('dy','0.35em')
  }