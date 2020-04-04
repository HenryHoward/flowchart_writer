var http = require('http');
var fs = require('fs');

const { parse } = require('querystring');

/*
function add_connection(code_str) {
  var filename = 'connections.py'
  fs.readFile(filename, 'utf8', function (err, file_dat) {
    if (err) throw err;
    file_dat += ('\n' + code_str) //TODO: replace this with magic that places the connection in the perfect place in the file
    fs.writeFile(filename, file_dat, 'utf-8', function(err) {
      if (err) throw (err);
    });
    console.log('file saved');
  });
}
*/

function collectRequestData(request, callback) {
  const FORM_URLENCODED = 'application/x-www-form-urlencoded; charset=UTF-8';
  if(request.headers['content-type'] === FORM_URLENCODED) {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      callback(body)
    });
  }
  else {
      callback(null);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    collectRequestData(req, result => {
      resultObj = JSON.parse(result)
      console.log('request received')
      console.log('result obj is:')
      console.log(resultObj)
      //network data
      //Now alter the request
      var positionsObj = resultObj[0]
      var updatesObj = resultObj[1]
      var db
      fs.readFile('connections.json', 'utf8', function (err, data) {
        if (err) throw err;
        db = JSON.parse(data);
        console.log('database loaded')
        modifyDatabase(db, updatesObj, positionsObj, function() {
          fs.readFile('index.html', function(err, data) {
            fs.readFile('connections.json', 'utf8', function (err, dbdata) {
              if (err) throw err;
              db = JSON.parse(dbdata);
              res.writeHead(200, {'Content-Type': 'text/html'});
              data = data.toString();
              data = data.replace("<!--edgesFromDataBaseGoHere-->", JSON.stringify(db.edges));
              data = data.replace("<!--nodesFromDataBaseGoHere-->", JSON.stringify(db.nodes));
              data = Buffer.from(data, 'utf8');
              res.write(data);
              res.end();
            });
          })
        })
      });
      //figure out data format

    });
  }
  else {
    fs.readFile('index.html', function(err, data) {
      fs.readFile('connections.json', 'utf8', function (err, dbdata) {
        if (err) throw err;
        db = JSON.parse(dbdata);
        res.writeHead(200, {'Content-Type': 'text/html'});
        data = data.toString();
        data = data.replace("<!--edgesFromDataBaseGoHere-->", JSON.stringify(db.edges));
        data = data.replace("<!--nodesFromDataBaseGoHere-->", JSON.stringify(db.nodes));
        data = Buffer.from(data, 'utf8');
        res.write(data);
        res.end();
      });
    })
  }
});


function modifyDatabase(database, changesObj, positionsObj, callback) {
  console.log('modifying database')
  /*
  changesObj is a JSON object of the following form:
  [
    {
      type: 'node',
      event: 'add',
      objs: [ [Object] ]
    },
    {
      type: 'edge',
      event: 'add',
      objs: [ [Object] ]
    }
  ]

  positionsObj is a JSON object of the following form:
  {
    nodeId1: {x: xValue, y:yValue},
    nodeId2: {x: xValue, y:yValue},
    ...
  }
  */

  var nodesQueryMerged = {};
  for (i=0;i<changesObj.length;i++) {
    iChange = changesObj[i]
    if ((iChange.type === 'nodes')&&(iChange.event != 'remove')) {
      for (j=0;j<iChange.objs.length;j++) {
        nodesQueryMerged[iChange.objs[j].id] = true
      }
    }
    if (iChange.event != 'remove') {
      for (j=0;j<iChange.objs.length;j++) {
        jObj = iChange.objs[j]
        if (iChange.event == 'update') {
          console.log('updating item:')
          console.log(iChange.objs[0])
          //if updating, find the item in the database and replace it
          var idxToUpdate
          for (k=0;k<database[iChange.type].length;k++) {
            if (database[iChange.type][k].id === jObj.id) {
              idxToUpdate = k
            }
          }
          console.log('replacing at index: '+idxToUpdate)
          console.log('(kth item before splice is: '+database[iChange.type][idxToUpdate])
          database[iChange.type].splice(idxToUpdate, 1)
          database[iChange.type].push(jObj)
          console.log('(kth item after replace is: '+database[iChange.type][idxToUpdate])
        }
        else {
          //if adding, simply add the object item to the database
          console.log('adding item:')
          console.log(iChange.objs[0])
          if (iChange.type === 'nodes') {
            jObj.hidden = true
            jObj.physics = false
          }
          console.log(jObj)
          database[iChange.type].push(jObj)
        }
      }
    }
    else {
      //if removing, find the object by id, remove from the database
      console.log('removing item/s:')
      console.log(iChange.ids)
      for (j=0;j<iChange.ids.length;j++) {
        jId = iChange.ids[j]
        var idxToDelete
        for (k=0;k<database[iChange.type].length;k++) {
          if (database[iChange.type][k].id === jId) {
            idxToDelete = k
            break
          }
        }
        console.log('idx is: '+k)
        console.log('number of nodes before splice = '+database[iChange.type].length)
        database[iChange.type].splice(k, 1)
        console.log('number of nodes after splice = '+database[iChange.type].length)
      }
    }
  }
  console.log('performing necessary mergers')
  stringReplacements = [];
  nodesQueryMergedList = Object.keys(nodesQueryMerged);
  for (i=0;i<nodesQueryMergedList.length;i++) {
    var iId = nodesQueryMergedList[i]
    var nMatches = 0 //if this is ever >1, emergency!
    for (j=0;j<database.nodes.length;j++) {
      if (iId === database.nodes[j].id) {
        nodesQueryMerged[iId] = database.nodes[j].label
        nMatches += 1
      }
    }
    if (nMatches > 1) {
      console.log('EMERGENCY')
      console.log('Multiple copies of id: '+iId)
    }
  }
  for (i=0;i<nodesQueryMergedList.length;i++) {
    console.log('currently looking at:')
    console.log(nodesQueryMergedList[i])
    stringReplacements.push([nodesQueryMergedList[i]]);
    if (nodesQueryMerged[nodesQueryMergedList[i]] != "") {
      for (j=database.nodes.length-1;j>=0;j--) {
        if (nodesQueryMergedList[i] != database.nodes[j].id) {
          if (nodesQueryMerged[nodesQueryMergedList[i]] === database.nodes[j].label) {
            stringReplacements[stringReplacements.length-1].push(database.nodes[j].id);
            database.nodes.splice(j, 1);
          };
        };
      };
    }
    else {
      console.log('blank node ignored from mergers')
    };
    if (stringReplacements[stringReplacements.length-1].length === 1) {
      stringReplacements.pop();
    }
  }
  console.log('stringReplacements list is:')
  console.log(stringReplacements)
  //perform replacements on the stringified version of JSON
  var databaseString = JSON.stringify(database)
  for (i=0;i<stringReplacements.length;i++) {
    iReplacements = stringReplacements[i]
    for (j=1;j<iReplacements.length;j++) {
      console.log('replacing all instances of: '+iReplacements[j]+' with:'+iReplacements[0])
      databaseString = databaseString.replace(new RegExp(iReplacements[j], 'g'), iReplacements[0])
    }
  }

  database = JSON.parse(databaseString)
  for (i=0;i<database.nodes.length;i++) {
    ithNode = database.nodes[i]
    console.log('x coord:'+positionsObj[ithNode.id].x)
    ithNode.x = positionsObj[ithNode.id].x
    console.log('y coord:'+positionsObj[ithNode.id].y)
    ithNode.y = positionsObj[ithNode.id].y
  }
  databaseString = JSON.stringify(database)

  fs.writeFile('connections.json', databaseString, function (err) {
    if (err) throw err;
    console.log('data logged')
  });
  callback();
}


server.listen(8080);
