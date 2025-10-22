/*
    WINDOWS Audio Visualizer Server (Fetch Audio Stream from Tidal and stream it to the audio visualizer)
*/

import { fetchMediaItemStream } from "@luna/lib.native";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";

let server: Server | null = null;
let serverPort: number = 0;

const isWindows = process.platform === 'win32';

const routers = {
    "/stream": handleStream,
};

function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || "";
    const route = url.startsWith("/stream/") ? "/stream" : (url as keyof typeof routers);
    if (route) {
        const handler = routers[route];
        if (handler) {
            handler(req, res);
            return;
        } else {
            res.statusCode = 404;
            res.end("Not Found (1)");
            return;
        }
    } else {
        res.statusCode = 404;
        res.end("Not Found");
    }
}

async function handleStream(req: IncomingMessage, res: ServerResponse) {
    const trackId = Number.parseInt(req.url?.split("/")[2] || "");
    if (!trackId) {
        res.statusCode = 400;
        res.end("Track ID is required");
        return;
    }

    try {
        // Dynamic import to avoid module resolution issues at build time
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const { BrowserWindow }: any = require("electron");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tidalWindow = BrowserWindow.fromId(1) as any;
        if (!tidalWindow) {
            res.statusCode = 503;
            res.end("Tidal window not found");
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trackInfo = await tidalWindow.webContents.executeJavaScript(`
            (async () => {
                const { MediaItem } = require("@luna/lib");
                const { PlayState } = require("@luna/lib");
                const playQueue = PlayState.playQueue;
                const queueElement = playQueue?.elements?.find(el => el.mediaItemId === ${trackId});
                
                if (queueElement) {
                    const mediaItem = await MediaItem.fromId(${trackId});
                    if (mediaItem) {
                        const playbackInfo = await mediaItem.playbackInfo();
                        return {
                            mediaItem: mediaItem.tidalItem,
                            playbackInfo: playbackInfo
                        };
                    }
                }
                
                const currentMedia = await MediaItem.fromPlaybackContext();
                if (currentMedia && currentMedia.tidalItem?.id === ${trackId}) {
                    const playbackInfo = await currentMedia.playbackInfo();
                    return {
                        mediaItem: currentMedia.tidalItem,
                        playbackInfo: playbackInfo
                    };
                }
                
                return null;
            })()
        `) as any;

        if (!trackInfo?.mediaItem || !trackInfo?.playbackInfo) {
            res.statusCode = 404;
            console.error(`[Audio Visualizer] Track with ID ${trackId} not found or no playback info available`);
            res.end("Track not found");
            return;
        }

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.statusCode = 200;
        res.writeHead(200, { "Content-Type": "audio/mpeg" });

        const stream = await fetchMediaItemStream(trackInfo.playbackInfo);
        stream.pipe(res);

        res.on('error', (err) => {
            console.error("[Audio Visualizer] Error in stream response:", err);
        });

    } catch (error) {
        console.error(`[Audio Visualizer] Error handling stream for track ${trackId}:`, error);
        res.statusCode = 500;
        res.end("Internal server error");
    }
}

async function startAudioVisualizerServer(port?: number): Promise<number> {
    server = createServer(handleRequest);
    server.listen(port ?? 0);
    const addrInfo = server.address();
    serverPort = typeof addrInfo === 'object' ? addrInfo?.port || 0 : Number.parseInt(addrInfo.split(':')[1]) || 0;
    console.log(`[Audio Visualizer] Server started on port ${serverPort}`);
    return serverPort;
}

function stopAudioVisualizerServer() {
    if (server) {
        server.close(() => {
            server = null;
            serverPort = 0;
            console.log("[Audio Visualizer] Server has been stopped.");
        });
    }
}

function getAudioVisualizerServerPort(): number {
    return serverPort;
}

export {
    startAudioVisualizerServer,
    stopAudioVisualizerServer,
    getAudioVisualizerServerPort,
    isWindows
};
