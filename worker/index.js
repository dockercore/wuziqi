export { GameRoom } from './GameRoom.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // WebSocket 升级
    if (url.pathname.startsWith('/room/') && request.headers.get('Upgrade') === 'websocket') {
      const roomId = url.pathname.split('/room/')[1]?.split('/')[0];
      if (!roomId) return new Response('Missing room ID', { status: 400 });

      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
