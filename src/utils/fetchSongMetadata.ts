export interface SongMetadata {
  composer?: string;
  album?: string;
  lyrics?: string;
  year?: number;
  source?: string;
}

export async function fetchSongMetadataFromMusicBrainz(songName: string): Promise<SongMetadata | null> {
  try {
    const response = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=recording:"${encodeURIComponent(songName)}"&fmt=json&limit=5`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.recordings || data.recordings.length === 0) {
      return null;
    }

    const recording = data.recordings[0];
    const metadata: SongMetadata = {
      source: 'MusicBrainz'
    };

    if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
      const composers = recording['artist-credit']
        .map((credit: any) => credit.artist?.name || credit.name)
        .filter(Boolean);
      if (composers.length > 0) {
        metadata.composer = composers.join(', ');
      }
    }

    if (recording.releases && recording.releases.length > 0) {
      metadata.album = recording.releases[0].title;
      if (recording.releases[0]['release-date']) {
        const year = parseInt(recording.releases[0]['release-date'].split('-')[0]);
        if (!isNaN(year)) {
          metadata.year = year;
        }
      }
    }

    return metadata;
  } catch (error) {
    console.error('Erro ao buscar em MusicBrainz:', error);
    return null;
  }
}

export async function fetchSongMetadataFromWikipedia(songName: string): Promise<SongMetadata | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(songName)}&format=json&origin=*`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const pages = data.query.pages;
    const page = Object.values(pages)[0] as any;

    if (!page.extract) return null;

    const metadata: SongMetadata = {
      source: 'Wikipedia'
    };

    const extract = page.extract;
    
    const composerMatch = extract.match(/(?:composer|music by|composed by)[:\s]+([^,\n]+)/i);
    if (composerMatch) {
      metadata.composer = composerMatch[1].trim();
    }

    const yearMatch = extract.match(/(?:written|composed)?[:\s]*(\d{4})/);
    if (yearMatch) {
      metadata.year = parseInt(yearMatch[1]);
    }

    return metadata;
  } catch (error) {
    console.error('Erro ao buscar em Wikipedia:', error);
    return null;
  }
}

export async function fetchSongMetadataFromOpenLibrary(songName: string): Promise<SongMetadata | null> {
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(songName)}&type=work&limit=1`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    const doc = data.docs[0];
    const metadata: SongMetadata = {
      source: 'Open Library'
    };

    if (doc.author_name && doc.author_name.length > 0) {
      metadata.composer = doc.author_name.join(', ');
    }

    if (doc.first_publish_year) {
      metadata.year = doc.first_publish_year;
    }

    return metadata;
  } catch (error) {
    console.error('Erro ao buscar em Open Library:', error);
    return null;
  }
}

export async function searchSongMetadata(songName: string): Promise<SongMetadata | null> {
  const results = await Promise.all([
    fetchSongMetadataFromMusicBrainz(songName),
    fetchSongMetadataFromWikipedia(songName),
    fetchSongMetadataFromOpenLibrary(songName)
  ]);

  return results.find(result => result !== null) || null;
}
