const Sequelize = require("sequelize")
const db = require("../database/db")
const bcrypt = require('bcryptjs')

module.exports = (function () {
    const Room = db.sequelize.define(
        'room', {
            name: {
                type: Sequelize.STRING,
                required: true,
                trim: true,
                unique: true,
                len: [3, 20]
            },
            user: {
                type: Sequelize.INTEGER,
                default: null
            },
            avatar: {
                type: Sequelize.INTEGER,
                required: true
            },
            password: {
                type: Sequelize.STRING,
                default: ''
            },
            access: {
                type: Sequelize.BOOLEAN,
                default: true
            },
            accessIds: {
                type: Sequelize.STRING,
                default: []
            },
            users: {
                type: Sequelize.INTEGER
            }
        }, {
            timestamps: {
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            }
        }, {

        }
    );
    Room.associate = function (models) {
        Room.hasMany(models.User);
    }
    Room.prototype.isValidPassword = function (password) {
        return bcrypt.compare(password, this.password);
    }
    return Room;
})();