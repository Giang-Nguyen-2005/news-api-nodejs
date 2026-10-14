function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
  });
}

module.exports = { getHealth };
