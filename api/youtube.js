const express = require('express');
const router = express.Router();
const { Innertube } = require('youtubei.js');

// YouTube API endpoint
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        api: {
          service: "YouTube",
          status: "ERROR",
          message: "URL parameter is required"
        }
      });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({
        api: {
          service: "YouTube",
          status: "ERROR",
          message: "Invalid YouTube URL"
        }
      });
    }

    // Initialize YouTube client
    const youtube = await Innertube.create();
    
    // Get video info
    const info = await youtube.getInfo(videoId);
    
    if (!info) {
      return res.status(404).json({
        api: {
          service: "YouTube",
          status: "ERROR",
          message: "Video not found"
        }
      });
    }

    // Format the response
    const formattedResponse = await formatYouTubeResponse(info, videoId, url);
    
    res.json(formattedResponse);

  } catch (error) {
    console.error('YouTube API Error:', error);
    
    res.status(500).json({
      api: {
        service: "YouTube",
        status: "ERROR",
        message: error.message || "Failed to fetch video information"
      }
    });
  }
});

// Helper function to extract video ID
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format file size from bytes to readable format
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main formatting function
async function formatYouTubeResponse(info, videoId, originalUrl) {
  const videoDetails = info.basic_info;
  const formats = info.streaming_data?.formats || [];
  const adaptive_formats = info.streaming_data?.adaptive_formats || [];
  
  // Combine all formats
  const allFormats = [...formats, ...adaptive_formats];
  
  // Get video formats (with video codec)
  const videoFormats = allFormats.filter(f => f.has_video && f.quality_label);
  
  // Get audio formats (without video)
  const audioFormats = allFormats.filter(f => !f.has_video && f.audio_quality);
  
  // Process video formats
  const processedVideoFormats = videoFormats.map((format, index) => {
    const qualityMap = {
      '1080p': 'FHD',
      '720p': 'HD',
      '480p': 'SD',
      '360p': 'SD',
      '240p': 'SD',
      '144p': 'SD'
    };
    
    const qualityLabel = format.quality_label || 'Unknown';
    const quality = qualityMap[qualityLabel] || 'SD';
    
    // Generate media ID (using timestamp and random number)
    const mediaId = Date.now() + Math.floor(Math.random() * 10000);
    
    // Calculate file size (approximate)
    const fileSizeBytes = format.content_length || 
                         (format.bitrate ? (format.bitrate * videoDetails.duration) / 8 : 0);
    
    return {
      type: "Video",
      name: `Media #${(index + 1).toString().padStart(3, '0')}`,
      mediaId: mediaId,
      mediaUrl: format.url || `https://s11.ytcontent.net/v3/videoProcess/${videoId}/${mediaId}/${qualityLabel}`,
      mediaPreviewUrl: format.url || '',
      mediaThumbnail: videoDetails.thumbnail?.[videoDetails.thumbnail.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      mediaRes: qualityLabel.replace('p', 'x') + qualityLabel.replace('p', ''),
      mediaQuality: quality,
      mediaDuration: formatDuration(videoDetails.duration),
      mediaExtension: "MP4",
      mediaFileSize: formatFileSize(fileSizeBytes),
      mediaTask: index % 2 === 0 ? "merge" : "download"
    };
  });

  // Process audio formats
  const processedAudioFormats = audioFormats.map((format, index) => {
    const mediaId = Date.now() + Math.floor(Math.random() * 10000) + 1000;
    
    const audioQuality = format.audio_quality === 'AUDIO_QUALITY_MEDIUM' ? '128K' :
                        format.audio_quality === 'AUDIO_QUALITY_LOW' ? '48K' :
                        '128K';
    
    const fileSizeBytes = format.content_length || 
                         (format.bitrate ? (format.bitrate * videoDetails.duration) / 8 : 0);
    
    return {
      type: "Audio",
      name: `Media #${(processedVideoFormats.length + index + 1).toString().padStart(3, '0')}`,
      mediaId: mediaId,
      mediaUrl: format.url || `https://s11.ytcontent.net/v3/audioProcess/${videoId}/${mediaId}/${audioQuality.replace('K', 'k')}`,
      mediaPreviewUrl: format.url || '',
      mediaThumbnail: videoDetails.thumbnail?.[videoDetails.thumbnail.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      mediaRes: false,
      mediaQuality: audioQuality,
      mediaDuration: formatDuration(videoDetails.duration),
      mediaExtension: "M4A",
      mediaFileSize: formatFileSize(fileSizeBytes),
      mediaTask: "download"
    };
  });

  // Combine all media items
  const mediaItems = [...processedVideoFormats, ...processedAudioFormats];

  // Get channel info
  const channelInfo = info.basic_info.channel;
  
  return {
    api: {
      service: "YouTube",
      status: "OK",
      message: "Processing started.",
      id: videoId,
      title: videoDetails.title || "",
      description: videoDetails.short_description || "",
      previewUrl: videoFormats[0]?.url || "",
      imagePreviewUrl: videoDetails.thumbnail?.[videoDetails.thumbnail.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      permanentLink: originalUrl || `https://youtu.be/${videoId}`,
      userInfo: {
        name: channelInfo?.name || "Unknown Channel",
        userCategory: false,
        userBio: channelInfo?.description || "",
        username: channelInfo?.url || "",
        userId: channelInfo?.id || "",
        userAvatar: channelInfo?.thumbnails?.[channelInfo.thumbnails.length - 1]?.url || "",
        userPhone: false,
        userEmail: false,
        internalUrl: channelInfo?.url || "",
        externalUrl: "https://support.google.com/youtube?p=sub_to_oac",
        accountCountry: null,
        dateJoined: "Mar 20, 2025", // This would need actual API call
        isVerified: channelInfo?.verified || false,
        dateVerified: false
      },
      mediaStats: {
        mediaCount: mediaItems.length.toString(),
        followersCount: false,
        followingCount: false,
        likesCount: videoDetails.like_count?.toString() || false,
        commentsCount: false,
        favouritesCount: false,
        sharesCount: false,
        viewsCount: videoDetails.view_count?.toLocaleString() || "0",
        downloadsCount: false
      },
      mediaItems: mediaItems
    }
  };
}

// Alternative endpoint with GET support
router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        error: "URL parameter is required",
        usage: "POST /youtube with {url: 'youtube_url'} or GET /youtube?url=youtube_url"
      });
    }
    
    // Forward to POST handler
    req.body = { url };
    return router.post(req, res);
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
