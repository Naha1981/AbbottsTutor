/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

// Function to extract YouTube video ID
export const getYouTubeVideoId = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmedUrl = url.trim();

  // Check 1: Is the input string itself a valid 11-character YouTube ID?
  // YouTube IDs are 11 characters long and use A-Z, a-z, 0-9, '_', '-'
  const directIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (directIdRegex.test(trimmedUrl)) {
    return trimmedUrl;
  }

  // Check 2: Try parsing as a full URL and extracting ID from standard patterns
  try {
    // new URL() requires an absolute URL. It will throw if a scheme (http/https) is missing.
    const parsedUrl = new URL(trimmedUrl);
    // Standard watch URLs (e.g., https://www.youtube.com/watch?v=VIDEO_ID)
    if (
      (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') &&
      parsedUrl.pathname === '/watch'
    ) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
    // Short URLs (e.g., https://youtu.be/VIDEO_ID)
    if (parsedUrl.hostname === 'youtu.be') {
      const videoId = parsedUrl.pathname.substring(1); // Remove leading '/'
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
    // Embed URLs (e.g., https://www.youtube.com/embed/VIDEO_ID)
    if (
      (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') &&
      parsedUrl.pathname.startsWith('/embed/')
    ) {
      const videoId = parsedUrl.pathname.substring(7); // Length of '/embed/'
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
  } catch (e) {
    // URL parsing failed (e.g., not an absolute URL, missing scheme).
    // This is not necessarily an error for ID extraction, as the regex fallback can handle partial URLs.
    // No console.warn here to keep console clean, as this is an expected path for some inputs.
  }

  // Check 3: Fallback using a comprehensive regex for various YouTube URL patterns.
  // This can catch IDs in partial URLs (e.g., "youtube.com/watch?v=ID") or complex URLs.
  // Regex explanation:
  // (?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)) - non-capturing group for common YouTube prefixes
  // ([a-zA-Z0-9_-]{11}) - capturing group for the 11-character video ID
  const generalRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/;
  const match = trimmedUrl.match(generalRegex);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  return null;
};

// Helper function to validate a YouTube video URL (by checking if an ID can be extracted)
export async function validateYoutubeUrl(
  url: string,
): Promise<{isValid: boolean; error?: string}> {
  if (getYouTubeVideoId(url)) {
    return {isValid: true};
  }
  return {isValid: false, error: 'Invalid YouTube URL'};
}

// Helper function to create a YouTube embed URL from a video URL or ID
export function getYoutubeEmbedUrl(url: string): string {
  const videoId = getYouTubeVideoId(url); // Use the robust ID extractor

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Fallback if ID extraction somehow fails, though less likely with improved getYouTubeVideoId
  console.warn(
    'Could not extract video ID for embedding from input, using original input (may not work):',
    url,
  );
  return url; 
}

// Fetches the YouTube video title using the oEmbed endpoint.
export async function getYouTubeVideoTitle(urlOrId: string): Promise<string> {
  // First, extract a clean video ID from the input.
  const videoId = getYouTubeVideoId(urlOrId);

  if (!videoId) {
    // If no valid video ID can be extracted, the input is not a recognizable YouTube video identifier.
    throw new Error(`Invalid YouTube video identifier: Could not extract a video ID from "${urlOrId}".`);
  }

  // If a video ID was successfully extracted, use it to form a canonical URL for the oEmbed request.
  const canonicalYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalYouTubeUrl)}&format=json`;

  try {
    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      // This could be due to network issues, or the video ID being valid but the video
      // not being available (e.g., private, deleted, region-restricted).
      throw new Error(`oEmbed request failed for video ID ${videoId} with status: ${response.status}. URL: ${oEmbedUrl}`);
    }

    const data = await response.json();
    if (data && data.title) {
      return data.title;
    } else {
      // This means the oEmbed request was successful, but the response didn't include a title.
      throw new Error(`No title found in oEmbed response for video ID ${videoId}.`);
    }
  } catch (error) {
    // Catch network errors from fetch() or errors thrown above.
    console.error(`Error in getYouTubeVideoTitle for ID ${videoId} (original input: "${urlOrId}"):`, error);
    // Re-throw the error so it can be handled by the calling code (e.g., to show a fallback title).
    throw error;
  }
}
