const express = require('express');
const app = express();
// const http = require('http').Server(app);
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
require('dotenv').config();

app.use(express.static('public'));
app.set('views', './views');
app.set('view engine', 'ejs');


let codeBlocks;
let mentorSocketId = null;

// connect to mongoDb Atlas
const client =  new MongoClient('mongodb+srv://or:Aa12345678@cluster0.wpc3d0s.mongodb.net/?retryWrites=true&w=majority')


async function connectToMongoDb() {
  try {
    // Connect the client to the server
    await client.connect();
  } catch(e){
    console.log(e)
  } 
}
async function initialize(){
  var db = await connectToMongoDb();
  var blocks = await getCodeBlocks();

  io.on('connection', socket => {
    // When a client joins the room
    socket.on('joinRoom', () => {
        // If there is no mentor yet, assign the current socket as the mentor
      if (mentorSocketId === null) {
        mentorSocketId = socket.id;
        socket.emit('isMentor', true);
        socket.data.isMentor = true; // Store the isMentor value in socket's custom data field
      } else {
        socket.emit('isMentor', false);
        socket.data.isMentor = false; // Store the isMentor value in socket's custom data field
      }
    });
    
    socket.on('codeChange', async data => {
        // Broadcast the code change to all connected clients except the sender
        socket.broadcast.emit('codeChange', data);
        if (!socket.data.isMentor) {
          try {
            const codeBlockTitle = data.codeBlockTitle; // Access the codeBlockTitle from the data object
            const db = client.db('codeBlocks');
            const collection = db.collection('codeBlocks');
      
            // Update the code block in the database
            await collection.updateOne(
              { title: codeBlockTitle },
              { $set: { code: data.code } }
            );
          } catch (error) {
            console.error('Failed to update code block in the database:', error);
          }
        }
    });
      
    socket.on('disconnect', () => {
      if (socket.id === mentorSocketId) {
        mentorSocketId = null;
      }
    });
  });

  
  // Lobby page route
  app.get('/', (req, res) => {
    res.render('lobbypage', { codeBlocks });
  });
  // Code block page route
  app.get('/codeblock/:title', (req, res) => {
      const codeBlockTitle = req.params.title;
      const codeBlock = codeBlocks.find(block => block.title === codeBlockTitle);
    
      if (!codeBlock) {
        return res.status(404).send('Code block not found');
      }
    // Check if mentor query parameter is present and set to true
      const isMentor = req.query.mentor === 'true';
      res.render('codeblock', { codeBlock, isMentor, codeBlockTitle });
    });


  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

initialize();

async function getCodeBlocks() {
  try {
    const db = client.db('codeBlocks');
    const collection = db.collection('codeBlocks');
    // Retrieve all the code blocks from the database
    codeBlocks = await collection.find({}).toArray();
  } catch (error) {
    console.error('Failed to retrieve code blocks from the database:', error);
  }
}

