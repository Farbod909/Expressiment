"use strict";

module.exports = function(imports) {

    let express = imports.modules.express;
    let Promise = imports.modules.Promise;
    let util = imports.util;
    let NormalGroup = imports.models.NormalGroup;
    let Group = imports.models.Group;

    let handler = util.handler;
    let requireLogin = util.requireLogin;
    let requireAdmin = util.requireAdmin;

    let router = express.Router();

    router.post("/groups/normal", handler(function*(req, res) {

        if (req.body.users.indexOf(req.user._id.toString()) === -1) {
            req.body.users.push(req.user._id);
        }

        let group = yield NormalGroup.createGroup({
            users: req.body.users,
            name: req.body.name,
            team: req.user.team,
        });

        res.json(group);

    }));

    router.get("/groups", requireLogin, handler(function*(req, res) {

        let groups = yield Group.find({
            _id: {
                $in: req.user.groups,
            },
        });

        res.json(groups);

    }));

    router.get("/groups/normal", requireLogin, handler(function*(req, res) {

        let groups = yield NormalGroup.find({
            _id: {
                $in: req.user.groups,
            },
        });

        res.json(groups);

    }));

    router.get("/groups/other", requireLogin, handler(function*(req, res) {

        let groups = yield NormalGroup.find({
            team: req.user.team,
            _id: {
                $not: {
                    $in: req.user.groups,
                },
            },
        });

        res.json(groups);

    }));

    router.get("/groups/id/:groupId", requireLogin, handler(function*(req, res) {
        
        let group = yield Group.findOne({
            _id: req.params.groupId,
        })
        
        res.json(group);
        
    }));

    // TODO: permissions other than just admin?
    router.post("/groups/normal/id/:groupId/users", requireAdmin, handler(function*(req, res) {

        yield NormalGroup.addUsers(req.params.groupId, req.body.users);

        res.end();
        
        // TODO: update addUsers to use findByIdAndUpdate and { new: true } to return the new audience perhaps

    }));

    router.delete("/groups/normal/id/:groupId/users/id/:userId", requireAdmin, handler(function*(req, res) {

        yield NormalGroup.removeUsers(req.params.groupId, [req.params.userId]);

        res.end();

    }));

    router.put("/groups/id/:groupId", requireLogin, handler(function*(req, res) {

        let group = yield NormalGroup.findOne({
            _id: req.params.groupId,
        });
        group.users = req.body.users;
        group.groups = req.body.groups;
        yield group.updateMembers();

        res.json(group); // TODO: add permissions?

    }));


    return router;
};
