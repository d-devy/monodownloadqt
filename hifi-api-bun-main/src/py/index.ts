// /py is compatible 1:1 with the hifi-api by bini, but no types

import Elysia from "elysia";
import { infoPY } from "./info";
import { trackPY } from "./track";
import { lyricsPY } from "./lyrics";
import { manifestsPY } from "./manifests";
import { widevinePY } from "./widevine";
import { recommendationsPY } from "./recommendations";
import { searchPY } from "./search";
import { albumPY } from "./album";
import { mixPY } from "./mix";
import { similarArtistsPY } from "./similarartists";
import { similarAlbumsPY } from "./similaralbums";
import { artistPY } from "./artist";
import { coverPY } from "./cover";
import { topVideosPY } from "./topvideos";
import { videoPY } from "./video";
import { artworksPY } from "./artworks";

export const apiPY = new Elysia({ prefix: "/py" })
  .use(infoPY)
  .use(trackPY)
  .use(lyricsPY)
  .use(manifestsPY)
  .use(widevinePY)
  .use(recommendationsPY)
  .use(searchPY)
  .use(albumPY)
  .use(mixPY)
  .use(similarArtistsPY)
  .use(similarAlbumsPY)
  .use(artistPY)
  .use(coverPY)
  .use(topVideosPY)
  .use(videoPY)
  .use(artworksPY)