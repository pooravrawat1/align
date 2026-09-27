using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Align.Integration
{
    /// <summary>Plays the shared match introduction once; never holds profiles or an API key.</summary>
    [RequireComponent(typeof(AudioSource))]
    public sealed class BioNarrationPlayer : MonoBehaviour
    {
        private AudioSource _audio;
        private UnityWebRequest _request;
        private Coroutine _routine;
        private string _matchKey = string.Empty;
        private bool _applicationPaused;

        public NarrationPlaybackState PlaybackState { get; private set; } = NarrationPlaybackState.Idle;

        private void Awake()
        {
            _audio = GetComponent<AudioSource>();
            _audio.playOnAwake = false;
            _audio.loop = false;
            _audio.spatialBlend = 0f;
        }

        public void SetMatch(string baseUrl, string roomCode, string clientId, string profileId, string matchKey)
        {
            if (!isActiveAndEnabled || string.IsNullOrEmpty(matchKey) || _matchKey == matchKey) return;
            ClearMatch();
            _matchKey = matchKey;
            PlaybackState = NarrationPlaybackState.Loading;
            _routine = StartCoroutine(ReadMatchIntroduction(baseUrl, roomCode, clientId, profileId));
        }

        // Cancellation is not completion; it must not unlock dismissal for a new match.
        public void StopPlayback()
        {
            if (PlaybackState == NarrationPlaybackState.Loading || PlaybackState == NarrationPlaybackState.Speaking)
                PlaybackState = NarrationPlaybackState.Idle;
            if (_routine != null) StopCoroutine(_routine);
            _routine = null;
            if (_request != null)
            {
                _request.Abort();
                _request.Dispose();
                _request = null;
            }
            if (_audio == null) return;
            _audio.Stop();
            AudioClip clip = _audio.clip;
            _audio.clip = null;
            if (clip != null) Destroy(clip);
        }

        public void ClearMatch()
        {
            StopPlayback();
            _matchKey = string.Empty;
            PlaybackState = NarrationPlaybackState.Idle;
        }

        private void OnDisable() => ClearMatch();
        private void OnApplicationPause(bool paused) => _applicationPaused = paused;

        private IEnumerator ReadMatchIntroduction(string baseUrl, string roomCode, string clientId, string profileId)
        {
            string endpoint = $"{baseUrl.TrimEnd('/')}/room/narration";
            _request = UnityWebRequestMultimedia.GetAudioClip(endpoint, AudioType.MPEG);
            _request.method = UnityWebRequest.kHttpVerbPOST;
            _request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(
                new NarrationRequest { roomCode = roomCode, clientId = clientId, profileId = profileId })));
            _request.SetRequestHeader("Content-Type", "application/json");
            _request.timeout = 35;
            yield return _request.SendWebRequest();

            if (_request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    _audio.clip = DownloadHandlerAudioClip.GetContent(_request);
                }
                catch (Exception)
                {
                    Debug.Log("[Align] Match narration could not be decoded.");
                }
            }
            else
            {
                // Optional audio failures must not interrupt the visual match flow.
                Debug.Log($"[Align] Match narration unavailable (HTTP {_request.responseCode}).");
            }
            _request.Dispose();
            _request = null;

            if (_audio.clip == null || _audio.clip.length <= 0f)
            {
                PlaybackState = NarrationPlaybackState.Failed;
                _routine = null;
                yield break;
            }

            PlaybackState = NarrationPlaybackState.Speaking;
            _audio.Play();
            // Waiting for the actual AudioSource, not the HTTP response or a timer,
            // keeps A/X from cutting off the introduction halfway through.
            yield return null;
            while (_audio.isPlaying || AudioListener.pause || _applicationPaused) yield return null;
            PlaybackState = NarrationPlaybackState.Completed;
            _routine = null;
        }

        [Serializable]
        private sealed class NarrationRequest
        {
            public string roomCode;
            public string clientId;
            public string profileId;
        }
    }
}
