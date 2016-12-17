"use strict";

module.exports = function(imports) {

    let express = imports.modules.express;
    let Autolinker = imports.modules.autolinker;
    let ObjectId = imports.modules.mongoose.Types.ObjectId;
    let Promise = imports.modules.Promise;
    let util = imports.util;

    let handler = util.handler;
    let requireLogin = util.requireLogin;
    let checkBody = util.middlechecker.checkBody;
    let types = util.middlechecker.types;
    let audienceQuery = util.hiddenGroups.audienceQuery;

    let Announcement = imports.models.Announcement;
    let User = imports.models.User;
    let Group = imports.models.Group;

    let router = express.Router();

    router.post("/announcements", checkBody({
        content: types.string,
        audience: types.audience,
    }), requireLogin, handler(function*(req, res) {

        if (req.body.audience.users.indexOf(req.user._id.toString()) === -1) {
            req.body.audience.users.push(req.user._id);
        }

        let arr = yield Promise.all([
            Announcement.create({
                author: req.user._id,
                content: req.body.content,
                audience: req.body.audience,
                timestamp: new Date(),
            }),
            User.find({
                _id: {
                    $in: req.body.audience.users,
                },
            }),
            Group.find({
                _id: {
                    $in: req.body.audience.groups,
                },
            }),
        ]);

        let announcement = arr[0];
        announcement = announcement.toObject();
        announcement.audience = { users: arr[1], groups: arr[2] };
        announcement.author = req.user;

        res.json(announcement);

        if (util.positions.isUserAdmin(req.user)) {
            let users = yield util.hiddenGroups.getUsersIn(announcement.audience);
            let recipients = util.mail.createRecipientList(users);
            let info = yield util.mail.sendEmail({
                to: recipients,
                subject: "New Announcement By " + req.user.firstname + " " + req.user.lastname,
                html: announcement.content,
            });
            console.log(info)
        }

    }));

    router.get("/announcements", checkBody({
        skip: types.string,
    }), requireLogin, handler(function*(req, res) {

        // find announcements that the user should be able to see
        let announcements = yield Announcement.find(audienceQuery(req.user), {
                // only respond with _id, author, content and timestamp
                _id: 1,
                author: 1,
                content: 1,
                timestamp: 1,
                audience: 1,
            }) // populate author and sort by timestamp, skip and limit are for pagination
            .populate("author audience.users audience.groups")
            .sort("-timestamp")
            .skip(parseInt(req.query.skip))
            .limit(20)
            .exec();

        res.json(announcements);

    }));

    router.delete("/announcements/id/:announcementId", checkBody(), requireLogin, handler(function*(req, res) {

        let announcement = yield Announcement.findOne({
            _id: req.params.announcementId
        });

        // TODO: if the user is an admin, check if they can see the announcement

        // check if user is eligible to delete said announcement
        if (req.user._id == announcement.author.toString() || util.positions.isUserAdmin(req.user)) {
            yield announcement.remove();
            res.end();
        } else {
            // warn me about attempted hax, bruh
            res.status(403).end("You do not have permission to do this");
            yield util.mail.sendEmail({
                to: "rafezyfarbod@gmail.com",
                subject: "MorTeam Security Alert!",
                text: "The user " + req.user.firstname + " " + req.user.lastname + " tried to perform administrator tasks. User ID: " + req.user._id
            });
        }

    }));

    return router;

};
