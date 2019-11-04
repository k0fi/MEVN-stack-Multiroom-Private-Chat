const Message = require('../models/Message');
const PrivateMessage = require('../models/PrivateMessage');
const Room = require('../models/Room');
const User = require('../models/User');
const Relation = require('../models/Relation');
const RoomRelation = require('../models/RoomRelation');
const Sequelize = require("sequelize")

module.exports = {
    //room, roomAdmin, user
    GET_RELATIONS: async data => {
        console.log('BE GET_RELATIONS', data.room, data.roomAdmin, data.user);
        const relations = {};
        relations.roomR = 0;
        relations.privateR = 0;
        relations.privateRs = {};

        const roomRs = RoomRelation.findOne({
            where: {
                room: data.room,
                user: data.user
            }
        }, {
            raw: true
        });
        const privateRs = Relation.findAll({
            where: {
                user: data.user
            }
        }, {
            raw: true
        });
        const privateR = Relation.findOne({
            where: {
                user: data.roomAdmin,
                touser: data.user
            }
        }, {
            raw: true
        });
        const value = await Promise.all([roomRs, privateRs, privateR]);
        relations.roomR = value[0] ? value[0].status : relations.roomR;
        relations.privateRs = value[1] ? value[1] : relations.privateRs;
        relations.privateR = value[2] ? value[2].status : relations.privateR;
        console.log('_______in getrelations func', JSON.stringify(relations.privateRs))
        return relations;
    },
    ADD_MESSAGE: async data => {
        const newMessage = new Message({
            content: data.content,
            admin: data.admin ? true : false,
            user: data.user ? data.user.id : null,
            room: data.room.id
        });

        let messageData = await newMessage.save();
        if (data.user) {
            const userData = await User.findByPk(data.user.id, {
                raw: true
            });
            messageData['user'] = userData;
        }
        console.log('++++++++++++++++++++BE', JSON.stringify(messageData));
        return messageData;
    },
    ADD_PRIVATE_MESSAGE: async data => {
        if (!data.user || !data.select || !data.content) return null;
        const newMessage = new PrivateMessage({
            content: data.content,
            admin: data.admin ? true : false,
            user: data.user ? data.user.id : null,
            touser: data.select ? data.select : null
        });

        const relat = await Relation.findOne({
            where: {
                touser: data.user.id,
                user: data.select
            }
        });

        if (relat && relat.status == 2) return null;
        let messageData = await newMessage.save();
        if (data.user) {
            const userData = await User.findByPk(data.user.id, {
                raw: true
            });
            const touserData = await User.findByPk(data.select, {
                raw: true
            });
            messageData['user'] = userData;
            messageData['touser'] = touserData;
            messageData['user']['status'] = relat ? relat.status : 0;
        }
        return messageData;
    },
    GET_USER_SOCKET: async data => {
        const userData = await User.findByPk(data.touser, {
            raw: true
        });
        return userData.socketid;
    },
    GET_MESSAGES: async data => {

        const messages = await Message.findAll({
            where: {
                room: data.room.id
            }
        });

        for (var i = 0; i < messages.length; i++) {
            const message = messages[i];
            await User.findByPk(message['user'], {
                    raw: true
                })
                .then(user => {
                    message['user'] = user;
                })
                .catch(err => {
                    console.log('err', err);
                })
        }
        return messages;
    },
    GET_PRIVATE_MESSAGES: async data => {

        const messages = await Message.findAll({
            where: {
                room: data.room.id
            }
        });

        for (var i = 0; i < messages.length; i++) {
            const message = messages[i];
            await User.findByPk(message['user'], {
                    raw: true
                })
                .then(user => {
                    message['user'] = user;
                })
                .catch(err => {
                    console.log('err', err);
                })
        }
        return messages;
    },
    // 0 - left content, 1 - Room Admin changed status for user
    CREATE_MESSAGE_CONTENT: async (room, socketId, status = 0) => {
        if (!status) {
            const user = room.previous.users.find(user => user.socketId === socketId);
            return user && user.handle ?
                `${user.handle} has left ${room.updated.name}` :
                `Unknown User has left ${room.updated.name}`;
        }
        const user = await User.findByPk(socketId.user, {
            raw: true
        });
        const status_text = !socketId.status ? ' was actived' : socketId.status == 1 ? ' was banned' : ' was blocked';
        return user && user.handle ?
            `${user.handle} ${status_text}` :
            `Unknown User ${status_text}`;
    },
    GET_ROOMS: async () => {
        const rooms = await Room.findAll({}, {
            raw: true
        });
        const users = await User.findAll({}, {
            raw: true
        });

        for (var i = 0; i < rooms.length; i++) {
            rooms[i]['user'] = users.find(user => user.id == rooms[i]['user']);
            if (rooms[i]['access']) {
                rooms[i]['users'] = users.filter(user => user['room_id'] == rooms[i]['id']).length;
            } else {
                rooms[i]['users'] = users.length - 1;
            }
        }
        return rooms;
        // return await Room.find({})
        //     .populate('user users.lookup', ['username', 'social', 'handle', 'image'])
        //     .select('-password');
    },
    GET_ROOM_USERS: async data => {
        return await User.findAll({
            where: {
                room_id: data.room.id
            }
        }, {
            raw: true
        });
    },
    GET_USERS: async () => {
        //Get All Users
        const relations = await Relation.findAll({
            raw: true
        });
        let users = [];
        await User.findAll({}, {
                raw: true
            })
            .then(result => {
                users = result;
                // for (const user of users) {
                //     const from_st = relations.filter((relation) => (relation['user'] == req.user.id) && (relation['touser'] == user.id));
                //     const to_st = relations.filter((relation) => (relation['touser'] == req.user.id) && (relation['user'] == user.id));
                //     user['dataValues']['from'] = from_st[0] ? from_st[0].status : false;
                //     user['dataValues']['to'] = to_st[0] ? to_st[0].status : false;
                // }
                // return res.status(200).json(users);
                return users;
            })
            .catch(err => {
                console.log('err', err);
                // return res.status(200).json(null);
                return null;
            })
    },
    UPDATE_ROOM_USERS: async data => {
        let room;
        const updateFields = ({
            room_id: data.room.id,
            socketid: data.socketId
        });
        await User.update(updateFields, {
                returning: true,
                raw: true,
                where: {
                    id: data.user.id
                }
            })
            .then(async info => {
                if (info[1]) {
                    room = await Room.findByPk(data.room.id, {
                        raw: true
                    })
                    const users = await User.findAll({
                        where: {
                            room_id: data.room.id
                        }
                    }, {
                        raw: true
                    })
                    room['users'] = users;
                }
            })
        return room;
    },
    UPDATE_PRIVATE_USER: async data => {
        const updateFields = ({
            socketid: data.socketId
        });
        await User.update(updateFields, {
                returning: true,
                raw: true,
                where: {
                    id: data.user.id
                }
            })
            .then(async info => {
                if (info[1]) {
                    return true;
                }
            })
        return false;
    },
    FILTER_ROOM_USERS: async data => {
        let room = await Room.findByPk(data.roomId);
        const updateFields = {
            'room_id': null
        }
        await User.update(updateFields, {
                returning: true,
                raw: true,
                where: {
                    socketid: data.socketId
                }
            })
            .then(async info => {
                if (info[1]) {
                    if (room) {
                        const previousUserState = room;

                        room['users'] = await User.findAll({
                            where: {
                                'room_id': room.id
                            }
                        }, {
                            raw: true
                        });

                        return {
                            previous: previousUserState,
                            updated: room
                        };
                    }
                }
            })
    },
    DELETE_USER: async data => {
        const msg_p = Message.destroy({
            where: {
                'user': data
            }
        });
        const pmsg_p = PrivateMessage.destroy({
            where: Sequelize.or({
                'user': data
            }, {
                'touser': data
            })
        });
        const rel_p = Relation.destroy({
            where: Sequelize.or({
                'user': data
            }, {
                'touser': data
            })
        });
        const user_p = User.destroy({
            where: {
                'id': data
            }
        });

        Promise.all([msg_p, pmsg_p, rel_p, user_p]).then(value => {
                return true;
            })
            .catch(err => {
                console.log(err, 'err');
                return false;
            })
    }
};