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
            _routine = StartCoroutine(ReadMatchIntroduction(baseUrl, roomCode, clientId, profileId));
        }

        // Dismissing a card stops speech without replaying it on the next room poll.
        public void StopPlayback()
        {
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
        }

        private void OnDisable() => ClearMatch();

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
                _audio.clip = DownloadHandlerAudioClip.GetContent(_request);
                if (_audio.clip != null) _audio.Play();
            }
            else
            {
                // Optional audio failures must not interrupt the visual match flow.
                Debug.Log($"[Align] Match narration unavailable (HTTP {_request.responseCode}).");
            }
            _request.Dispose();
            _request = null;
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
