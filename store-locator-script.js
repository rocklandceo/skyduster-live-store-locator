// Mapbox token
    mapboxgl.accessToken = 'pk.eyJ1Ijoicm9ja2xhbmQtY2VvIiwiYSI6ImNsbHI5dHU3aTBrOGY0bG0yb2RrMTd6ZGYifQ.1dMr1yO7WZW3zlQA25H46Q';

    // Initialize the map
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/rockland-ceo/clltjtmy7004o01rcgz1i8z6h',
        center: [-118.239364, 34.058241],
        zoom: 7
    });

    const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/1n8emJif1ErvRCM_Mn0UBIUGhYY8RNYdrN4aQaZTSoNY/gviz/tq?tqx=out:csv&sheet=Off-Premise-Accounts";

    function handleMarkerTap(feature) {
      console.log("Tapped feature:", feature);
        const locationData = feature.properties;
      console.log("Location data:", locationData);
        const ID = feature.properties['Array ID'];
      console.log("ID:", ID);


          // Map each element in the .locations-map_item div to the corresponding data from the CSV using the updated headers
          $(".location-image").attr("src", locationData["Customer Profile Image"]);
          $(".card_heading").text(locationData["Customer Name"]);
          $(".locations-map_city").text(locationData["City"]);
          $(".location_street-address").text(locationData["Street"]);
          $(".location-city_block").text(locationData["City"]); // Reused the same "City" header as per your list
          $(".location-zip_block").text(locationData["Zip"]);
          $(".card_link-block_phone").attr("href", "tel:" + locationData["Phone URL"]);
          $(".card_link-text-block_phone").text(locationData["Phone"]);
          $(".card_link-block_directions").attr("href", locationData["Google Maps URL"]);
          $(".card_link-text-directions").text("Get Directions");
          $(".card_description").html(locationData["Customer Details"]);
              if (locationData["Customer Details"].trim() === "") {
                  $(".location-description_wrapper").hide();
              } else {
                  $(".location-description_wrapper").show();
              }

              // Check if Phone URL is blank
              if (locationData["Phone URL"].trim() === "") {
                  $(".card_link-block_phone").hide();
              } else {
                  $(".card_link-block_phone").show();
              }

          // Show the .locations-map_item
          $(".locations-map_item, .locations-map_wrapper").addClass("is--show");
      }

    $.get(GOOGLE_SHEETS_CSV_URL, function(data) {

        // Error handling for CSV parsing
        const parsedCSV = Papa.parse(data, {
          header: true,
          skipEmptyLines: true
        });

        if (parsedCSV.errors.length > 0) {
          console.error("Errors parsing CSV data: ", parsedCSV.errors);
          alert("There was an error processing location data. Please notify the website administrator.");
          return;
        }

        // Error handling for data integrity
        const requiredColumns = ["Latitude", "Longitude", "Customer Profile Image", "Customer Name", "City", "Street", "Zip", "Phone URL", "Phone", "Google Maps URL", "Customer Details"];
          const missingColumns = requiredColumns.filter(column => !parsedCSV.meta.fields.includes(column));

        if (missingColumns.length > 0) {
          console.error("Missing essential columns in CSV data: ", missingColumns);
          alert("There's an issue with the location data structure. Please notify the website administrator.");
          return;
        }

        let geojsonData = {
            type: 'FeatureCollection',
            features: []
        };

        parsedCSV.data.forEach(row => {
            geojsonData.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(row.Longitude), parseFloat(row.Latitude)]
                },
                properties: row // This line adds all columns from your CSV as properties
            });
        });

        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

        parsedCSV.data.forEach(row => {
            const lat = parseFloat(row.Latitude);
            const lon = parseFloat(row.Longitude);

            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
        });

        map.on('load', function() {
            map.addSource('locations', {
                'type': 'geojson',
                'data': geojsonData,
                'cluster': true,
                'clusterRadius': 50
            });

            // Now, use fitBounds to adjust the map's viewport
            const bounds = [
                [minLon, minLat], // Southwest coordinates
                [maxLon, maxLat]  // Northeast coordinates
            ];

            map.fitBounds(bounds, {
                padding: 20
            });

            // Control for navigation
            map.addControl(new mapboxgl.NavigationControl());

            // Cluster circles
            map.addLayer({
                'id': 'clusters',
                'type': 'circle',
                'source': 'locations',
                'filter': ['has', 'point_count'],
                'paint': {
                    'circle-color': '#1a3c34',
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        20,     // circle radius for cluster count = 20
                        100,    // circle radius for cluster count = 100
                        30,     // circle radius for cluster count = 30
                        750,    // circle radius for cluster count = 750
                        40      // circle radius for cluster count = 40
                    ]
                }
            });

            // Cluster count labels
            map.addLayer({
                'id': 'cluster-count',
                'type': 'symbol',
                'source': 'locations',
                'filter': ['has', 'point_count'],
                'layout': {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Arial Unicode MS Bold'],
                    'text-size': 12
                },
                'paint': {
                    'text-color': '#f1e4b2'
                }
            });

            console.log(handleMarkerTap);
            // Custom markers for each location
            map.loadImage('https://uploads-ssl.webflow.com/63a8b8d4f3ba371ef3eca92c/64eb74f60202b90fc8998067_skydusterAsset%201map-marker.png', function(error, image) {
                if (error) throw error;
                map.addImage('custom-marker', image);

                map.addLayer({
                    'id': 'locations',
                    'type': 'symbol',
                    'source': 'locations',
                    'filter': ['!', ['has', 'point_count']],
                    'layout': {
                        'icon-image': 'custom-marker',
                        'icon-size': 0.35
                    }
                });

                map.on('click', 'clusters', (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ['clusters']
                    });
                    const clusterId = features[0].properties.cluster_id;
                    map.getSource('locations').getClusterExpansionZoom(
                        clusterId,
                        (err, zoom) => {
                            if (err) return;

                            map.easeTo({
                                center: features[0].geometry.coordinates,
                                zoom: zoom
                            });
                        }
                    );
                });
            });

            // Geocode Address using Mapbox's Geocoding API
                function geocodeAddress(address, callback) {
                    const geocodingURL = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
                    
                    $.getJSON(geocodingURL, function(data) {
                        if (data.features && data.features.length) {
                            callback(null, data.features[0].geometry.coordinates);
                        } else {
                            callback('No results found');
                        }
                    }).fail(function() {
                        callback('Error accessing geocoding service');
                    });
                }

            // Find the nearest location with Turf
                function findNearestLocation(userCoords, locations) {
                    let nearestLocation;
                    let nearestDistance = Infinity;
                    
                    locations.forEach(location => {
                        const locationCoords = location.geometry.coordinates;
                        const distance = turf.distance(turf.point(userCoords), turf.point(locationCoords));
                        
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            nearestLocation = location;
                        }
                    });
                    
                    return nearestLocation;
                }

            // Display the nearest location
                    $("#search-button").on("click", function() {
                        const address = $("#address-input").val();
                        if (!address) return;

                        geocodeAddress(address, function(error, coords) {
                            if (error) {
                                alert(error);
                                return;
                            }

                            const locationsSource = map.getSource('locations');
                            const nearestLocation = findNearestLocation(coords, locationsSource._data.features);

                            if (nearestLocation) {
                                handleMarkerTap(nearestLocation);
                                map.flyTo({
                                    center: nearestLocation.geometry.coordinates,
                                    zoom: 12
                                });
                            } else {
                                alert('No nearby locations found.');
                            }
                        });
                    });

            // Event listeners for the map
            map.on('click', 'locations', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['locations']
                });
                console.log("Features found: ", features.length);
                if (features.length) {
                    handleMarkerTap(features[0]);
                }
            });

            // Add this just after the above event listener
            map.on('click', function(e) {
              const features = map.queryRenderedFeatures(e.point, {
                layers: ['locations']
              });
              console.log("Features found: ", features.length);
              if (!features.length) {
                $(".locations-map_item, .locations-map_wrapper").removeClass("is--show");
              }
            });

                // Hide the .mapboxgl-ctrl-attrib element
            $('.mapboxgl-ctrl-attrib').hide();

            // Append your image to .mapboxgl-ctrl-bottom-right
            $('.mapboxgl-ctrl-bottom-right').append('<img src="https://uploads-ssl.webflow.com/63a8b8d4f3ba371ef3eca92c/63a8d6cef3af9936f047f013_SD-Logo_HORIZONTAL_GreenAsset%201.svg" alt="Skyduster Dark Logo" class="custom-map-image">');


    
        });
      }).fail(function(jqXHR, textStatus, errorThrown) {
          console.error("Error fetching data: ", textStatus, errorThrown);
          alert("There was an error fetching location data. Please try again later.");
      });

    // Add an event listener for the close button
    $(".close-block").on('click', function() {
      $(".locations-map_item, .locations-map_wrapper").removeClass("is--show");
    });