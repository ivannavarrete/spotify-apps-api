sp = getSpotifyApi(1);
sp.core.registerSchema(
	[
		{
			name: 'UserInfo', fields: [
				{id: 1, name: 'country', type: 'string'}
			]
		},
		{
			name: 'WhatsNewRequest', fields: [
				{id: 1, name: 'user_info', type: 'UserInfo'}
			]
		},
		{
			name: 'NewAlbum', fields: [
				{id: 1, name: 'album_uri', type: 'string'},
				{id: 2, name: 'artist_uris', type: '*string'}
			]
		},
		{
			name: 'NewAlbumsReply', fields: [
				{id: 1, name: 'albums', type: '*NewAlbum'}
			]
		},
		{
			name: 'FriendsPlaylist', fields: [
				{id: 1, name: 'uri', type: 'string'},
				{id: 2, name: 'friends', type: '*string'},
				{id: 4, name: 'name', type: 'string'},
				{id: 5, name: 'creator', type: 'string'}
			]
		},
		{
			name: 'FriendsPlaylistsReply', fields: [
				{id: 1, name: 'playlists', type: '*FriendsPlaylist'},
			]
		},
		{
			name: 'FriendsTrackToplists', fields: [
				{id: 1, name: 'uri', type: 'string'},
				{id: 2, name: 'friends', type: '*string'}
			]
		},
		{
			name: 'FriendsTrackToplistsReply', fields: [
				{id: 1, name: 'tracks', type: '*FriendsTrackToplists'}
			]
		},
		{
			name: 'NewFriendsReply', fields: [
				{id: 1, name: 'friends', type: '*string'}
			]
		},
		{
			name: 'RegionTrack', fields: [
				{id: 1, name: 'uri', type: 'string'}
			]
		},
		{
			name: 'RegionTracksReply', fields: [
				{id: 1, name: 'tracks', type: '*RegionTrack'}
			]
		},
		{
			name: 'RegionPlaylist', fields: [
				{id: 1, name: 'uri', type: 'string'},
				{id: 2, name: 'subscribers', type: 'int32'},
				{id: 3, name: 'name', type: 'string'},
				{id: 4, name: 'creator', type: 'string'}
			]
		},
		{
			name: 'RegionPlaylistReply', fields: [
				{id: 1, name: 'playlists', type: '*RegionPlaylist'}
			]
		},
		{
			name: 'WhatsNewReply', fields: [
				{id: 1, name: 'new_albums', type: 'NewAlbumsReply'},
				{id: 2, name: 'friends_playlists', type: 'FriendsPlaylistsReply'},
				{id: 3, name: 'friends_tracks', type: 'FriendsTrackToplistsReply'},
				{id: 4, name: 'new_friends', type: 'NewFriendsReply'},
				{id: 5, name: 'region_tracks', type: 'RegionTracksReply'},
				{id: 6, name: 'region_playlists', type: 'RegionPlaylistReply'}
			]
		},
		{
			name: 'SocialFeedReply', fields: [
				{id: 1, name: 'items', type: '*FeedItem'}
			]
		},
		{
			name: 'FeedItem', fields: [
				{id: 1, name: 'user', type: 'FacebookUser'},
				{id: 2, name: 'message', type: 'string'},
				{id: 3, name: 'link', type: 'string'},
				{id: 4, name: 'created', type: 'int32'}
			]
		},
		{
			name: 'FacebookUser', fields: [
				{id: 1, name: 'facebook', type: 'int64'},
				{id: 2, name: 'spotify', type: 'string'},
				{id: 3, name: 'image', type: 'string'}
			]
		}
	]
);
