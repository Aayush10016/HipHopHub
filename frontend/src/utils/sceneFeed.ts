export interface SceneStory { id: string; title: string; summary: string; category: string; date: string; source: string; url: string }
export interface SceneEvent { id: number; artistId: number; artist: string; title: string; venue: string; city: string; country: string; eventDate: string; ticketUrl: string; source: string }
export const confirmedEvents: SceneEvent[] = [
  {
    "id": -101,
    "artistId": 8,
    "artist": "Raftaar",
    "venue": "Major Dhyan Chand National Stadium",
    "city": "New Delhi",
    "country": "India",
    "eventDate": "2026-10-17T19:00:00+05:30",
    "ticketUrl": "https://www.district.in/events/raftaar-live-concert-delhi-oct17-2026-buy-tickets",
    "source": "District",
    "title": "Raftaar \u00b7 Live in Delhi"
  },
  {
    "id": -102,
    "artistId": 3,
    "artist": "Seedhe Maut",
    "venue": "N.S.I.C. Exhibition Grounds",
    "city": "New Delhi",
    "country": "India",
    "eventDate": "2026-11-01T19:30:00+05:30",
    "ticketUrl": "https://www.bandsintown.com/e/1040229833-seedhe-maut-at-n.s.i.c-exhibition-grounds",
    "source": "Bandsintown \u00b7 artist listing",
    "title": "Seedhe Maut \u00b7 HorrorCon India"
  }
]
