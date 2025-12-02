function checkUserRole(req, res, next) {
    if (!req.session.user || !req.session.user.role) {
        console.error('User is not logged in or role is undefined.');
        return res.status(401).send('Unauthorized: User is not logged in.');
    }
  
    // Check if the user has the "administrator" role
    const userRole = req.session.user.role;
  
    if (userRole === 'administrator') {
        return next(); // User has the "administrator" role, allow access
    } else {
        console.error('Access denied: User does not have administrator role.');
        return res.status(403).send('Forbidden: You must be an administrator.');
    }
}
  
module.exports = { checkUserRole };