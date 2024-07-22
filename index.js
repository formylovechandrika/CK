const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 5000;

const SUPABASE_URL = 'https://ldgsewdxtbmffdbnqkrk.supabase.co/';
const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3Nld2R4dGJtZmZkYm5xa3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE2MzYyNDcsImV4cCI6MjAzNzIxMjI0N30.nzKQs9wiX6m6V4rBZlqxz5Wi5lniHrhso3I1g2itRmc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const corsOptions = {
 origin: 'https://ck-git-main-salt-spidys-projects.vercel.app', //
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

app.use(cors(corsOptions));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + (ext === '.mp4' ? '.m3u8' : ext);
    cb(null, filename);
  },
});

const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded' });
    }

    if (path.extname(req.file.originalname) === '.mp4') {
      const outputDir = path.join(__dirname, 'uploads');
      const outputM3U8 = path.join(outputDir, req.file.filename.replace('.mp4', '.m3u8'));

      ffmpeg(req.file.path)
        .output(outputM3U8)
        .format('hls')
        .on('end', async () => {
          try {
            if (fs.existsSync(outputM3U8)) {
              const m3u8FileBuffer = fs.readFileSync(outputM3U8);

              // Upload .m3u8 file
              const { data: m3u8Data, error: m3u8Error } = await supabase.storage
                .from('videos')
                .upload(path.basename(outputM3U8), Buffer.from(m3u8FileBuffer), {
                  cacheControl: '3600',
                  upsert: false,
                  contentType: 'application/x-mpegURL',
                });

              if (m3u8Error) {
                return res.status(500).send({ message: 'Error uploading M3U8 file to Supabase', error: m3u8Error.message });
              }

              // Upload .ts files
              const tsFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.ts'));
              for (const tsFile of tsFiles) {
                const tsFilePath = path.join(outputDir, tsFile);
                const tsFileBuffer = fs.readFileSync(tsFilePath);
                const { error: tsError } = await supabase.storage
                  .from('videos')
                  .upload(tsFile, Buffer.from(tsFileBuffer), {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'video/MP2T',
                  });

                if (tsError) {
                  console.error('Error uploading TS file to Supabase:', tsError);
                }
              }

              // Clean up local files
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting local MP4 file:', err);
              });
              fs.unlink(outputM3U8, (err) => {
                if (err) console.error('Error deleting local M3U8 file:', err);
              });
              tsFiles.forEach(tsFile => {
                fs.unlink(path.join(outputDir, tsFile), (err) => {
                  if (err) console.error('Error deleting local TS file:', err);
                });
              });

              res.send({ message: 'File uploaded and converted to M3U8 successfully', file: m3u8Data });
            } else {
              res.status(500).send({ message: 'Conversion to M3U8 failed' });
            }
          } catch (err) {
            console.error('Error uploading to Supabase:', err);
            res.status(500).send({ message: 'Error uploading to Supabase', error: err.message });
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          res.status(500).send({ message: 'Error converting file', error: err.message });
        })
        .run();
    } else {
      res.send({ message: 'File uploaded successfully', file: req.file });
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).send({ message: 'Internal Server Error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
