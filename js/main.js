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



function show_tracks_table() {
  console.log('show_tracks_table')
  load_data('data/flowerpatch/flowerpatch_20240606_11h04.tracks_visits.csv',
    function(data) {
      for (row of data) {
        row['track_id'] = +row['track_id']
        row['frame'] = +row['frame']
      }
      create_table(data.sort(sortByMultipleProperties(['track_id','frame'])), ['track_id','frame','flower_id','cx','cy','crop_filename'], "#main")

      // Add image in column crop_filename if non empty
      d3.select('#main > table > tbody')
      .selectAll('tr>td.col_crop_filename')
      .html(function(d) {
        if ((d.crop_filename == undefined)||(d.crop_filename == '')) {
          return `no img`
        }
        return `<div>${d.crop_filename}</div><div><img src="${'data/flowerpatch/crops/'+d.crop_filename}" style="width:128px; height:128px;"/></div>`
      })
    }
  ).then( ()=>console.log('DONE') )
}


// DEMO REID

function show_reid_table(show_images=false, filter_color_id=false) {
  console.log('show_reid_table')
  load_data('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv',
    function(data) {
      if (filter_color_id) {
        data = data.filter(d => d.color_id == filter_color_id)
      }

      console.log(data)

      for (row of data) {
        row['img_number'] = Math.round(+row['img_number'])
        row['track'] = +row['track']
        row['frame'] = +row['frame']
      }


      create_table(data, ['img_number','color_id','track','frame','new_filepath'], "#main")

      
      d3.select('#main').insert("button",":first-child") // Prepend button callback before table
       //.attr("href","#")
      .on('click', () => show_reid_table(!show_images, filter_color_id)) 
      .text("Toogle images")
      

      if (show_images) {
        //Add image in column crop_filename if non empty
        d3.select('#main > table > tbody')
        .selectAll('tr>td.col_new_filepath')
        .html(function(d) {
          return `<div>${d.new_filepath}</div><div><img src="${'/data/reid/images/'+d.new_filepath}" style="width:128px; height:128px;"/></div>`
        })
      } else { // Just put a link
        d3.select('#main > table > tbody')
        .selectAll('tr>td.col_new_filepath')
        .html(function(d) {
          return `<a href="${'/data/reid/images/'+d.new_filepath}" target="crop_window">${d.new_filepath}</a>`
        })
      }

      // Link to table filtered for a single color_id
      d3.select('#main > table > tbody')
        .selectAll('tr>td.col_color_id')
        .html(function(d) {
          //return 'TEST'
          return `<a href="#" onclick="show_reid_table(${show_images}, '${d.color_id}');">${d.color_id}</a>`
        })
    }
  ).then( ()=>console.log('DONE') )
}


function show_groupby2() {
  load_data('data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv',
    create_table_groupby2
  )
}

function create_table_groupby2(data) {
  console.log(data)

  d3.select('#msg').html('show_group_by2...')

  // Clear the existing content
  d3.select('#main').html('');

  // Group the data by 'color_id', then by 'track_id'
  const groupedData = d3.group(data, d => d.color_id, d => d.track);

  // Render the groups by 'color_id'
  const groups = d3.select('#main')
      .selectAll('.group')
      .data(Array.from(groupedData), ([key, values]) => key) // Convert Map to array and use key as the data key
      .join('div')
      .attr('class', 'group');

  // Add a header for each 'color_id' group
  groups.append('h3')
  .attr('class', 'group-header')
  .html(([key]) => `<span class="triangle">▶</span> Group: ${key}`) // Add the triangle
  .style('cursor', 'pointer') // Make the header clickable
      .on('click', function(event, [key, values]) {
          // Toggle visibility of the group's children
          const groupDiv = d3.select(this.parentNode).select('.items');
          const isHidden = groupDiv.style('display') === 'none';
          groupDiv.style('display', isHidden ? 'block' : 'none');
          
        // Update the triangle indicator
        const triangle = d3.select(this).select('.triangle');
        triangle.text(isHidden ? '▼' : '▶');
      });

  // Add a container for the 'track_id' rows (initially hidden)
  groups.append('div')
      .attr('class', 'items')
      .style('display', 'none') // Initially collapsed
      .selectAll('.track-row')
      .data(([key, tracks]) => Array.from(tracks), ([trackId, items]) => trackId) // Convert inner Map to array
      .join('div')
      .attr('class', 'track-row')
      .style('flex-wrap', 'nowrap') // Prevent wrapping of images
      .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
      .style('white-space', 'nowrap') // Ensure images stay on one line
      .style('margin-bottom', '10px') // Add spacing between rows
      .each(function([trackId, items]) {
          const trackRow = d3.select(this);

          // Add a header for each 'track_id'
          trackRow.append('h4')
              .text(`Track ID: ${trackId}`)
              .style('margin', '5px 0') // Add spacing above and below the header
              .style('font-size', '14px')
              .style('color', '#333');

          // Add a container for the images in this 'track_id'
          trackRow.append('div')
              .attr('class', 'track-items')
              .style('display', 'flex') // Use flexbox for horizontal layout
              .style('flex-wrap', 'nowrap') // Prevent wrapping of images
              .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
              .style('white-space', 'nowrap') // Ensure images stay on one line
              .selectAll('.item-container')
              .data(items) // Use the items in this 'track_id'
              .join('div')
              .attr('class', 'item-container')
              .style('text-align', 'center') // Center-align the content
              .style('margin', '5px') // Add some spacing between items
              .each(function(d) {
                  const container = d3.select(this);

                  //let crop = 'position:absolute; clip: rect(16px, 92px, 80px, 32px); top:-16px; left:-32px;'

                  // Add the image
                  container
                      //.append('div')
                      //.attr('style', 'width:64px; height:64px; display:block; margin:auto; overflow:hidden; position:relative;')
                      .append('img')
                      .attr('src', '/data/reid/images/'+d.new_filepath)
                      .attr('style', 'width:128px; height:128px; display:block; margin:auto;');

                  // Add the frame ID below the image
                  container.append('div')
                      .attr('class', 'frame-id')
                      .text(`Frame: ${d.frame}`)
                      .style('margin-top', '5px') // Add spacing above the text
                      .style('font-size', '12px') // Adjust font size
                      .style('color', '#555'); // Optional: Change text color
              });
      });
      d3.select('#msg').html('show_group_by2... done')
}
