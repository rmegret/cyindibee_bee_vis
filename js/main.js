var gdata


// UTILITARY FUNCTIONS

function sortByMultipleProperties(properties) {
  return function (a, b) {
    for (let prop of properties) {
      let dir = 1;
      if (prop[0] === '-') {
        dir = -1;
        prop = prop.slice(1);
      }
      if (prop[0] === '$') {
        prop = prop.slice(1);
        A = +a[prop]
        B = +b[prop]
        if (A<B) return -1 * dir;
        if (A>B) return 1 * dir;
      } else {
        if (a[prop] < b[prop]) return -1 * dir;
        if (a[prop] > b[prop]) return 1 * dir;
      }
    }
    return 0;
  };
}

function load_data(filename, callback) {
  P = d3.csv(filename)
  .then(data => callback(data))
  .catch(error => {
    console.error('Error loading the data', error);
  });
  return P
}

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

function show_visits_table() {
  console.log('show_visits_table')
  load_data('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv',
    data => create_table(data, ['track_id','bee_id','flower_id','start_frame','end_frame'])
  )
}

function show_flowers_table() {
  console.log('show_flowers_table')
  load_data('data/flowerpatch/flowerpatch_20240606_11h04.flowers.csv',
    function(data) {
      create_table(data, ['flower_id','color','cx','cy','idx','idy'], "#main")

      // Add custom color vis
      d3.select('#main > table > tbody')
        .selectAll('tr>td.col_color')
        .html(function(d) {
          return `<div style="width: 1em; height: 1em; border: 1px solid black; background-color: ${d.color}; display: inline-block;"></div> ${d.color}`
        })
    })
}

function show_bee_labels_table() {
  console.log('show_bee_labels_table')
  load_data('data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv',
    function(data) {
      create_table(data, ['bee_id','paint_color','paint_size','paint_shape','comment'], "#main")

      // Add custom color vis
      d3.select('#main > table > tbody')
        .selectAll('tr>td.col_paint_color')
        .html(function(d) {
          return `<div style="width: 1em; height: 1em; border: 1px solid black; background-color: ${d.paint_color}; display: inline-block;"></div> ${d.paint_color}`
        })
    }
  )

  
}



function show_tracks_table(show_images=false, only_with_crops=false) {
  console.log('show_tracks_table')
  load_data('data/flowerpatch/flowerpatch_20240606_11h04.tracks_visits.csv',
    function(data) {
      for (row of data) {
        row['track_id'] = +row['track_id']
        row['frame'] = +row['frame']
      }

      if (only_with_crops) {
        data = data.filter(d => d.crop_filename!='')
      }

      create_table(data.sort(sortByMultipleProperties(['track_id','frame'])), ['track_id','frame','flower_id','cx','cy','crop_filename'], "#main")
      
      var div = d3.select('#main').insert("div",":first-child")  // Prepend button callback before table
      div.append("button")
        .on('click', () => show_tracks_table(!show_images, only_with_crops)) 
        .text("Toogle images")
      div.append('button') 
        .on('click', () => show_tracks_table(show_images, !only_with_crops)) 
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
    }
  ).then( ()=>console.log('DONE') )
}

