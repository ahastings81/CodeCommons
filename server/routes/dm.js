const express = require('express');
const { z } = require('zod');
const { read, write } = require('../utils/db');
const { nanoid } = require('nanoid');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/** Helpers */
function findOrCreateConversation(userA, userB) {
  let convos = read('dm_conversations.json');
  let convo = convos.find(
    c => Array.isArray(c.participants) &&
    c.participants.includes(userA) &&
    c.participants.includes(userB)
  );
  if (!convo) {
    convo = {
      id: nanoid(),
      participants: [userA, userB],
      createdAt: Date.now(),
      lastMessageAt: null,
      lastMessage: null
    };
    convos.push(convo);
    write('dm_conversations.json', convos);
  }
  return convo;
}

function embedOther(convo, meId) {
  const users = read('users.json');
  const otherId = (convo.participants || []).find(x => x !== meId);
  const other = users.find(u => u.id === otherId);
  return {
    ...convo,
    other: other ? {
      id: other.id,
      name: other.name || other.email || 'Unknown User',
      avatarUrl: other.avatarUrl || null
    } : { id: otherId, name: 'Unknown User', avatarUrl: null }
  };
}

/** Schemas */
const sendSchema = z.object({
  content: z.string().optional().default(''),
  media: z.array(z.object({
    type: z.string(), // 'image' | 'video' | 'file'
    url: z.string(),
    name: z.string().optional()
  })).optional().default([])
});

/** List conversations for the authed user */
router.get('/conversations', authRequired, (req, res) => {
  const meId = req.user.id;
  const convos = read('dm_conversations.json')
    .filter(c => (c.participants || []).includes(meId))
    .sort((a,b) => (b.lastMessageAt||0) - (a.lastMessageAt||0))
    .map(c => embedOther(c, meId));
  res.json(convos);
});

/** Start (or get) a conversation with a user */
router.post('/start/:otherId', authRequired, (req, res) => {
  const meId = req.user.id;
  const otherId = req.params.otherId;
  if (!otherId || otherId === meId) return res.status(400).json({ error: 'Invalid user' });

  const convo = findOrCreateConversation(meId, otherId);
  res.json(embedOther(convo, meId));
});

/** Get messages for a conversation */
router.get('/:id/messages', authRequired, (req, res) => {
  const meId = req.user.id;
  const convos = read('dm_conversations.json');
  const convo = convos.find(c => c.id === req.params.id);
  if (!convo || !convo.participants.includes(meId)) return res.status(404).json({ error: 'Not found' });

  const messages = read('dm_messages.json')
    .filter(m => m.conversationId === convo.id)
    .sort((a,b) => (a.createdAt||0) - (b.createdAt||0));

  res.json(messages);
});

/** Send a message in a conversation */
router.post('/:id/messages', authRequired, (req, res) => {
  const meId = req.user.id;
  const convos = read('dm_conversations.json');
  const convoIdx = convos.findIndex(c => c.id === req.params.id);
  if (convoIdx === -1) return res.status(404).json({ error: 'Conversation not found' });

  const convo = convos[convoIdx];
  if (!convo.participants.includes(meId)) return res.status(403).json({ error: 'Forbidden' });

  const parsed = sendSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { content = '', media = [] } = parsed.data;
  if (!content.trim() && media.length === 0) {
    return res.status(400).json({ error: 'Message is empty' });
  }

  // Save message
  const messages = read('dm_messages.json');
  const msg = {
    id: nanoid(),
    conversationId: convo.id,
    senderId: meId,
    content,
    media,
    createdAt: Date.now(),
    readBy: [meId]
  };
  messages.push(msg);
  write('dm_messages.json', messages);

  // Update conversation last message metadata
  const updatedConvo = {
    ...convo,
    lastMessageAt: msg.createdAt,
    lastMessage: { id: msg.id, senderId: msg.senderId, content: msg.content, media: msg.media, createdAt: msg.createdAt }
  };
  convos[convoIdx] = updatedConvo;
  write('dm_conversations.json', convos);

  // Persist notifications for all recipients (exclude sender)
  const recipients = (convo.participants || []).filter(uid => uid !== meId);
  if (recipients.length > 0) {
    const notifications = read('notifications.json');
    const preview = (content || '').slice(0, 140);
    for (const uid of recipients) {
      notifications.push({
        id: nanoid(),
        userId: uid,
        type: 'dm',
        createdAt: Date.now(),
        read: false,
        payload: {
          conversationId: convo.id,
          messageId: msg.id,
          fromUserId: meId,
          preview
        }
      });
    }
    write('notifications.json', notifications);
  }

  // Realtime emits
  try {
    const io = req.app.get('io');
    if (io) {
      // notify recipients (for header bell / badges)
      for (const uid of recipients) {
        io.to('user:' + uid).emit('notify', { type: 'dm', conversationId: convo.id, message: msg });
      }
      // stream into the dm room (for open thread windows)
      io.to('dm:' + convo.id).emit('dm:message', msg);
    }
  } catch {}

  res.json(msg);
});

/** Edit a message (optional) */
router.put('/:id/messages/:msgId', authRequired, (req, res) => {
  const meId = req.user.id;
  const convos = read('dm_conversations.json');
  const convo = convos.find(c => c.id === req.params.id);
  if (!convo || !convo.participants.includes(meId)) return res.status(404).json({ error: 'Not found' });

  const messages = read('dm_messages.json');
  const idx = messages.findIndex(m => m.id === req.params.msgId && m.conversationId === convo.id && m.senderId === meId);
  if (idx === -1) return res.status(404).json({ error: 'Message not found' });

  const schema = z.object({ content: z.string().min(1) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  messages[idx] = { ...messages[idx], content: parsed.data.content, editedAt: Date.now() };
  write('dm_messages.json', messages);

  // Update convo lastMessage if needed
  if (convo.lastMessage && convo.lastMessage.id === messages[idx].id) {
    const convosAll = read('dm_conversations.json');
    const cidx = convosAll.findIndex(c => c.id === convo.id);
    if (cidx !== -1) {
      convosAll[cidx] = { ...convo, lastMessage: { ...convo.lastMessage, content: messages[idx].content, editedAt: messages[idx].editedAt } };
      write('dm_conversations.json', convosAll);
    }
  }

  try {
    const io = req.app.get('io');
    if (io) {
      io.to('dm:' + convo.id).emit('dm:messageEdited', messages[idx]);
    }
  } catch {}

  res.json(messages[idx]);
});

/** Delete a message (optional) */
router.delete('/:id/messages/:msgId', authRequired, (req, res) => {
  const meId = req.user.id;
  const convos = read('dm_conversations.json');
  const convo = convos.find(c => c.id === req.params.id);
  if (!convo || !convo.participants.includes(meId)) return res.status(404).json({ error: 'Not found' });

  const messages = read('dm_messages.json');
  const idx = messages.findIndex(m => m.id === req.params.msgId && m.conversationId === convo.id && m.senderId === meId);
  if (idx === -1) return res.status(404).json({ error: 'Message not found' });

  const msgId = messages[idx].id;
  messages.splice(idx, 1);
  write('dm_messages.json', messages);

  try {
    const io = req.app.get('io');
    if (io) {
      io.to('dm:' + convo.id).emit('dm:messageDeleted', { conversationId: convo.id, msgId });
    }
  } catch {}

  res.json({ ok: true });
});

module.exports = router;
